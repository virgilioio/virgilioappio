-- fit_job_movements: who on a job moved, and why. Runs inside a block that ends
-- by raising its result, so nothing it writes is kept.
do $t$
declare
  adm uuid; jb uuid; ids uuid[];
  r text := '';
  n int; rec record;
begin
  select m.user_id into adm
  from public.members m join public.profiles p on p.user_id = m.user_id
  where lower(p.email) = 'allan@virgilio.tech' and m.user_status = 'active'
  limit 1;

  -- A job with four applications that have no Gio Fit history yet.
  select a.job_id, (array_agg(a.id))[1:4] into jb, ids
  from public.job_candidate_associations a
  where not exists (select 1 from public.fit_score_history h where h.association_id = a.id)
  group by a.job_id having count(*) >= 4
  limit 1;
  r := 'setup=' || (adm is not null and jb is not null and array_length(ids, 1) = 4);

  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  insert into public.fit_score_history (association_id, candidate_id, job_id, version, score, scoring, trigger, generated_at)
  select a.id, a.candidate_id, a.job_id, v.version, v.score, v.scoring, 'queue', now() - v.ago
  from public.job_candidate_associations a
  join (values
    -- 1: up 8 after a scorecard
    (1, 9001, 60, '{"cause":"first"}'::jsonb, interval '3 days'),
    (1, 9002, 68, '{"cause":"scorecard"}'::jsonb, interval '1 day'),
    -- 2: a change of recipe is not a move
    (2, 9001, 70, '{"cause":"first"}'::jsonb, interval '3 days'),
    (2, 9002, 61, '{"cause":"recipe"}'::jsonb, interval '1 day'),
    -- 3: one point is noise; an assessment with no recorded cause is not marked
    (3, 9001, 55, '{"cause":"first"}'::jsonb, interval '5 days'),
    (3, 9002, 56, '{"cause":"job"}'::jsonb, interval '4 days'),
    -- 4: down 9 after the job changed, but 40 days ago
    (4, 9001, 80, '{"cause":"first"}'::jsonb, interval '50 days'),
    (4, 9002, 71, '{"cause":"job"}'::jsonb, interval '40 days')
  ) as v(slot, version, score, scoring, ago) on a.id = ids[v.slot];

  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'allan@virgilio.tech')::text, true);
  select count(*) into n from public.fit_job_movements(jb) where association_id = any(ids);
  r := r || ' only_the_real_move=' || (n = 1);
  select * into rec from public.fit_job_movements(jb) where association_id = ids[1];
  r := r || ' up_8_after_scorecard=' || (rec.score = 68 and rec.previous_score = 60 and rec.cause = 'scorecard');
  r := r || ' recipe_not_marked=' || not exists (select 1 from public.fit_job_movements(jb) where association_id = ids[2]);
  r := r || ' one_point_not_marked=' || not exists (select 1 from public.fit_job_movements(jb) where association_id = ids[3]);
  r := r || ' old_move_not_marked=' || not exists (select 1 from public.fit_job_movements(jb) where association_id = ids[4]);

  -- A later assessment replaces the marker: here a refresh that takes 3 points off.
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  insert into public.fit_score_history (association_id, candidate_id, job_id, version, score, scoring, trigger, generated_at)
  select a.id, a.candidate_id, a.job_id, 9003, 65, '{"cause":"refresh"}'::jsonb, 'refresh', now()
  from public.job_candidate_associations a where a.id = ids[1];
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'allan@virgilio.tech')::text, true);
  select * into rec from public.fit_job_movements(jb) where association_id = ids[1];
  r := r || ' latest_assessment_wins=' || (rec.score = 65 and rec.previous_score = 68 and rec.cause = 'refresh');

  -- Someone with no access to the job sees nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  select count(*) into n from public.fit_job_movements(jb);
  r := r || ' stranger_sees_nothing=' || (n = 0);

  r := r || ' anon_cant_call=' || (not has_function_privilege('anon', 'public.fit_job_movements(uuid)', 'execute'))
         || ' signed_in_can_call=' || has_function_privilege('authenticated', 'public.fit_job_movements(uuid)', 'execute');

  raise exception 'RESULT %', r;
end $t$;
