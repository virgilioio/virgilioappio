-- Run after 20261112061203_interview_notes_retry inside a transaction that is rolled back.
-- Retry on an interview's notes: the interviewer or whoever manages the job, never
-- once the scorecard is submitted, never twice in a row; it starts one run.
--   outsider     in the workspace, no seat on the job
--   manager      another active admin of the interview's workspace (not its interviewer)
-- The interview is the latest drafted one with a draft scorecard.
-- Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

create or replace function pg_temp.as_user(_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.as_admin()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
end $$;

create or replace function pg_temp.err_of(_sql text)
returns text
language plpgsql
as $$
begin
  execute _sql;
  return 'none';
exception when others then
  return sqlstate;
end $$;

do $$
declare
  manager uuid;
  outsider constant uuid := '4110ac77-f873-46f7-9bf2-c5774bfab028';
  bk record;
  queued_before bigint;
  queued_after bigint;
  st text;
  e text;
begin
  select b.id, b.interviewer_id, b.job_candidate_association_id, b.job_hiring_stage_id
    into bk
  from public.interview_transcripts t
  join public.scheduled_bookings b on b.id = t.booking_id
  where t.status = 'drafted'
    and b.interviewer_id <> outsider
    and exists (select 1 from public.job_stage_scorecards s
                where s.source_booking_id = b.id and s.is_ai_draft)
  order by t.status_at desc
  limit 1;
  insert into t_results values ('found a drafted interview to try it on', bk.id is not null);
  select m.user_id into manager
  from public.scheduled_bookings b
  join public.members m on m.tenant_id = b.tenant_id
  where b.id = bk.id and m.user_status = 'active' and m.system_role = 'admin' and m.user_id <> bk.interviewer_id
  limit 1;
  insert into t_results values ('found another admin to try it as', manager is not null);

  -- Nobody gets a run 2 minutes after the last; age the row so the checks below see an old run.
  update public.interview_transcripts set status_at = now() - interval '1 hour' where booking_id = bk.id;
  select count(*) into queued_before from net.http_request_queue;

  perform pg_temp.as_user(outsider);
  e := pg_temp.err_of(format('select public.interview_notes_retry(%L)', bk.id));
  insert into t_results values ('someone with no seat on the job is refused (' || e || ')', e = 'GIN01');

  perform pg_temp.as_admin();
  perform set_config('request.jwt.claims', '', true);
  e := pg_temp.err_of(format('select public.interview_notes_retry(%L)', bk.id));
  insert into t_results values ('no signed-in person is refused (' || e || ')', e = 'GIN01');

  perform pg_temp.as_user(bk.interviewer_id);
  e := pg_temp.err_of(format('select public.interview_notes_retry(%L)', bk.id));
  insert into t_results values ('the interviewer can ask (' || e || ')', e = 'none');
  perform pg_temp.as_admin();
  select status into st from public.interview_transcripts where booking_id = bk.id;
  select count(*) into queued_after from net.http_request_queue;
  insert into t_results values ('the row reads received again (' || st || ')', st = 'received');
  insert into t_results values ('one run was queued (' || (queued_after - queued_before) || ')', queued_after - queued_before = 1);
  insert into t_results values ('the run carries the booking and find',
    exists (select 1 from net.http_request_queue q
            where q.url like '%/functions/v1/generate-scorecard-from-transcript'
              and convert_from(q.body, 'UTF8')::jsonb = jsonb_build_object('booking_id', bk.id, 'find', true)));

  perform pg_temp.as_user(bk.interviewer_id);
  e := pg_temp.err_of(format('select public.interview_notes_retry(%L)', bk.id));
  insert into t_results values ('asking again at once is refused (' || e || ')', e = 'GIN03');

  -- A run stuck for over 10 minutes counts as over, even mid-draft.
  perform pg_temp.as_admin();
  update public.interview_transcripts set status = 'drafting', status_at = now() - interval '11 minutes' where booking_id = bk.id;
  perform pg_temp.as_user(manager);
  e := pg_temp.err_of(format('select public.interview_notes_retry(%L)', bk.id));
  insert into t_results values ('an admin can ask once a run has been stuck 10 minutes (' || e || ')', e = 'none');

  perform pg_temp.as_admin();
  update public.interview_transcripts set status = 'drafting', status_at = now() - interval '5 minutes' where booking_id = bk.id;
  perform pg_temp.as_user(manager);
  e := pg_temp.err_of(format('select public.interview_notes_retry(%L)', bk.id));
  insert into t_results values ('not while Gio is drafting (' || e || ')', e = 'GIN03');

  -- Submitted: a run would change nothing.
  perform pg_temp.as_admin();
  update public.interview_transcripts set status = 'drafted', status_at = now() - interval '1 hour' where booking_id = bk.id;
  update public.job_stage_scorecards set is_ai_draft = false where source_booking_id = bk.id;
  perform pg_temp.as_user(bk.interviewer_id);
  e := pg_temp.err_of(format('select public.interview_notes_retry(%L)', bk.id));
  insert into t_results values ('not once the scorecard is submitted (' || e || ')', e = 'GIN02');

  perform pg_temp.as_admin();
  insert into t_results values ('anon can''t call it',
    not has_function_privilege('anon', 'public.interview_notes_retry(uuid)', 'execute'));
  insert into t_results values ('signed-in people can call it',
    has_function_privilege('authenticated', 'public.interview_notes_retry(uuid)', 'execute'));
end $$;

select * from t_results;
