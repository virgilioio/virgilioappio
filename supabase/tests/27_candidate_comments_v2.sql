-- Run after 20261018235003_candidate_comments_v2 and 20261018234855_candidate_comments_job_optional inside a transaction that is rolled back.
-- Fake comments on a real candidate in Virgilio's workspace: Allan writes, the
-- support account and another teammate are tagged. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert, select on t_results to authenticated;
create temp table t_ids (k text primary key, v uuid);
grant select on t_ids to authenticated;
create temp table t_out (k text, n bigint, err text);
grant insert, select on t_out to authenticated;
insert into t_ids values
  ('allan', '7acbeead-b1b8-442c-b316-bff9779dc7de'),
  ('support', 'e9bfab1d-5e9a-49d0-af89-5f97ef89b6fe'),
  ('third', 'd294b6a2-3736-43f6-b8c3-d85845fcbe89'),
  ('stranger', '00000000-0000-4000-8000-000000000099'),
  ('job', '7d16b23e-0ff0-4583-8ff7-19cdb6fb6e07'),
  ('cand', '26226545-59d7-44b6-8de6-cf9a7e4e51d5'),
  ('c1', gen_random_uuid()), ('c2', gen_random_uuid()), ('c3', gen_random_uuid()), ('c4', gen_random_uuid());

-- ---- Allan writes ---------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);
do $$
declare
  i jsonb := (select jsonb_object_agg(k, v) from t_ids);
begin
  -- c1: in the job, tags support and someone who isn't in the workspace.
  insert into public.candidate_comments (id, candidate_id, job_id, author_id, author_email, content)
  values ((i->>'c1')::uuid, (i->>'cand')::uuid, (i->>'job')::uuid, (i->>'allan')::uuid, 'allan@virgilio.tech',
    'Fake: @[Support](user:' || (i->>'support') || ') and @[Nobody](user:' || (i->>'stranger') || ') please look');
  insert into t_out values ('c1', 1, 'none');
  -- c2: private, no tags.
  insert into public.candidate_comments (id, candidate_id, job_id, author_id, author_email, content, is_private)
  values ((i->>'c2')::uuid, (i->>'cand')::uuid, (i->>'job')::uuid, (i->>'allan')::uuid, 'allan@virgilio.tech', 'Fake: only for me', true);
  insert into t_out values ('c2', 1, 'none');
  -- c3: private but tags someone: refused.
  begin
    insert into public.candidate_comments (id, candidate_id, job_id, author_id, author_email, content, is_private)
    values ((i->>'c3')::uuid, (i->>'cand')::uuid, (i->>'job')::uuid, (i->>'allan')::uuid, 'allan@virgilio.tech',
      'Fake: @[Support](user:' || (i->>'support') || ')', true);
    insert into t_out values ('c3', 1, 'none');
  exception when others then
    insert into t_out values ('c3', 0, sqlstate);
  end;
  -- Writing as someone else: refused.
  begin
    insert into public.candidate_comments (candidate_id, job_id, author_id, author_email, content)
    values ((i->>'cand')::uuid, (i->>'job')::uuid, (i->>'support')::uuid, 'x', 'Fake: forged author');
    insert into t_out values ('forged', 1, 'none');
  exception when others then
    insert into t_out values ('forged', 0, sqlstate);
  end;
  -- c4: on the standalone profile, outside any job (needs 20261018234855).
  insert into public.candidate_comments (id, candidate_id, author_id, author_email, content)
  values ((i->>'c4')::uuid, (i->>'cand')::uuid, (i->>'allan')::uuid, 'allan@virgilio.tech', 'Fake: a note outside any job');
  insert into t_out values ('c4', 1, 'none');
  -- Edit c1 to also tag the third teammate.
  update public.candidate_comments set content = content || ' and @[Third](user:' || (i->>'third') || ')'
  where id = (i->>'c1')::uuid;
end $$;
insert into t_out select 'people', count(*), string_agg(user_id::text, ',') from public.comment_people('26226545-59d7-44b6-8de6-cf9a7e4e51d5');
reset role;

-- ---- Support reads ----------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e9bfab1d-5e9a-49d0-af89-5f97ef89b6fe","role":"authenticated","email":"support@virgilio.tech"}', true);
insert into t_out select 'support sees c1', count(*), null from public.candidate_comments where id = (select v from t_ids where k = 'c1');
insert into t_out select 'support sees c2', count(*), null from public.candidate_comments where id = (select v from t_ids where k = 'c2');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated"}', true);
insert into t_out select 'allan sees c2', count(*), null from public.candidate_comments where id = (select v from t_ids where k = 'c2');
reset role;

insert into t_results select 'save: a comment in a job saves again', (select n = 1 from t_out where k = 'c1');
insert into t_results select 'save: the organization comes from the job',
  (select organization_id = (select organization_id from public.jobs where id = (select v from t_ids where k = 'job'))
   from public.candidate_comments where id = (select v from t_ids where k = 'c1'));
insert into t_results select 'save: a comment outside any job saves, in the author''s workspace',
  (select n = 1 from t_out where k = 'c4')
  and exists (select 1 from public.candidate_comments where id = (select v from t_ids where k = 'c4') and job_id is null and organization_id is not null);
insert into t_results select 'tag: support is notified, with a link to the candidate in the job',
  exists (select 1 from public.notifications where user_id = (select v from t_ids where k = 'support') and category = 'mention'
          and metadata->>'comment_id' = (select v from t_ids where k = 'c1')::text
          and action_url = '/jobs/' || (select v from t_ids where k = 'job') || '/candidates/' || (select v from t_ids where k = 'cand'));
insert into t_results select 'tag: the preview reads @Support, not the code',
  exists (select 1 from public.notifications where user_id = (select v from t_ids where k = 'support')
          and metadata->>'comment_id' = (select v from t_ids where k = 'c1')::text and preview like 'Fake: @Support and @Nobody please look%');
insert into t_results select 'tag: someone outside the workspace gets nothing',
  not exists (select 1 from public.notifications where user_id = (select v from t_ids where k = 'stranger'));
insert into t_results select 'edit: only the newly tagged person is notified',
  (select count(*) = 1 from public.notifications where user_id = (select v from t_ids where k = 'support')
     and metadata->>'comment_id' = (select v from t_ids where k = 'c1')::text)
  and exists (select 1 from public.notifications where user_id = (select v from t_ids where k = 'third')
     and metadata->>'comment_id' = (select v from t_ids where k = 'c1')::text);
insert into t_results select 'private: saved', (select n = 1 from t_out where k = 'c2');
insert into t_results select 'private: the author sees it', (select n = 1 from t_out where k = 'allan sees c2');
insert into t_results select 'private: a teammate does not', (select n = 0 from t_out where k = 'support sees c2');
insert into t_results select 'private: not in the activity log',
  not exists (select 1 from public.activities where entity_id = (select v from t_ids where k = 'c2'));
insert into t_results select 'shared: a teammate who can see the candidate reads it', (select n = 1 from t_out where k = 'support sees c1');
insert into t_results select 'private: a comment that tags someone is refused', (select err = '23514' from t_out where k = 'c3');
insert into t_results select 'author: nobody writes as someone else', (select err = '42501' from t_out where k = 'forged');
insert into t_results select 'people: lists teammates who can see the candidate, not yourself',
  (select n >= 2 and err like '%e9bfab1d-5e9a-49d0-af89-5f97ef89b6fe%' and err not like '%7acbeead%' from t_out where k = 'people');
insert into t_results select 'client decisions: no longer filed as mentions',
  not exists (select 1 from pg_proc where proname in ('record_dossier_decision', 'record_pipeline_decision')
              and prosrc like '%''mention''::notification_category%')
  and not exists (select 1 from public.notifications where category = 'mention' and metadata ? 'decision' and actor_user_id is null);
insert into t_results select 'grants: user_can_see_candidate is internal',
  not has_function_privilege('authenticated', 'public.user_can_see_candidate(uuid,uuid)', 'execute');

select check_name as check, ok from t_results;
