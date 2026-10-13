-- Removing a pipeline stage keeps its scorecards (Allan, 2026-10-13).
-- Scorecards feed the candidate's profile and their Gio Fit score, so they must
-- survive a stage being taken out of a hiring plan. When a stage goes, its
-- scorecards move to the stage its candidates move to (the stage before, or the
-- stage after when it was first), with the answers they hold. Each moved
-- scorecard remembers where it came from in moved_from_stage_name, so the app
-- can label it and so it never counts as that new stage's own evaluation.
--
-- Answers hang off the stage's scorecard questions. The questions that have
-- answers move with them to the receiving stage's scorecard template, marked
-- retired_at, so they keep the answers readable but never show up as questions
-- to fill in on that stage. Unanswered questions go with the stage, as before.
--
-- carry_stage_history(from, to) does this for one job's stage and is what the
-- hiring plan calls; the library-stage retire functions use the same internal
-- step for every job. A job whose only stage this is, with candidates or
-- scorecards in it, stops the removal instead of losing them.

alter table public.job_stage_scorecards
  add column moved_from_stage_name text,
  add column moved_at timestamptz;

alter table public.scorecard_interview_questions
  add column retired_at timestamptz;

-- Internal: no permission check; only other functions call it.
-- Its search_path includes public because the stage-change trigger on
-- job_candidate_associations (log_candidate_stage_change) names its enum type
-- without a schema. Every name in here is schema-qualified.
create function public.carry_stage_history_internal(p_from uuid, p_to uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from public.job_hiring_stages%rowtype;
  v_to public.job_hiring_stages%rowtype;
  v_name text;
  v_target_template uuid;
  v_visibility text;
  v_candidates integer := 0;
  v_scorecards integer := 0;
  v_questions integer := 0;
begin
  select * into v_from from public.job_hiring_stages where id = p_from;
  select * into v_to from public.job_hiring_stages where id = p_to;
  if v_from.id is null or v_to.id is null or v_from.job_id <> v_to.job_id or p_from = p_to then
    raise exception 'Both stages must belong to the same job';
  end if;

  select coalesce(nullif(trim(v_from.custom_stage_name), ''), s.stage_name, 'Removed stage')
    into v_name
  from public.job_stages s where s.id = v_from.stage_id;
  v_name := coalesce(v_name, 'Removed stage');

  update public.job_candidate_associations
  set current_stage_id = p_to,
      pipeline_position = null,
      updated_at = now()
  where current_stage_id = p_from;
  get diagnostics v_candidates = row_count;

  -- Answered questions keep their answers readable on the receiving stage.
  if exists (
    select 1
    from public.scorecard_interview_questions q
    join public.stage_scorecard_templates t on t.id = q.scorecard_template_id
    where t.job_hiring_stage_id = p_from
      and exists (select 1 from public.scorecard_question_responses r where r.question_id = q.id)
  ) then
    select id into v_target_template
    from public.stage_scorecard_templates
    where job_hiring_stage_id = p_to
    order by created_at
    limit 1;

    if v_target_template is null then
      select visibility into v_visibility
      from public.stage_scorecard_templates
      where job_hiring_stage_id = p_from
      order by created_at
      limit 1;
      insert into public.stage_scorecard_templates (job_hiring_stage_id, created_by, visibility)
      values (p_to, auth.uid(), coalesce(v_visibility, 'private'))
      returning id into v_target_template;
    end if;

    update public.scorecard_interview_questions q
    set scorecard_template_id = v_target_template,
        retired_at = coalesce(q.retired_at, now()),
        updated_at = now()
    from public.stage_scorecard_templates t
    where t.id = q.scorecard_template_id
      and t.job_hiring_stage_id = p_from
      and exists (select 1 from public.scorecard_question_responses r where r.question_id = q.id);
    get diagnostics v_questions = row_count;
  end if;

  update public.job_stage_scorecards
  set stage_instance_id = p_to,
      moved_from_stage_name = coalesce(moved_from_stage_name, v_name),
      moved_at = coalesce(moved_at, now())
  where stage_instance_id = p_from;
  get diagnostics v_scorecards = row_count;

  return jsonb_build_object('candidates', v_candidates, 'scorecards', v_scorecards, 'questions', v_questions);
end;
$$;

revoke all on function public.carry_stage_history_internal(uuid, uuid) from public, anon, authenticated;

-- For the hiring plan: anyone who can work on the job's pipeline.
create function public.carry_stage_history(p_from uuid, p_to uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job uuid;
begin
  select job_id into v_job from public.job_hiring_stages where id = p_from;
  if v_job is null or not public.can_access_job_pipeline(v_job) then
    raise exception 'You can''t change this job''s pipeline';
  end if;
  return public.carry_stage_history_internal(p_from, p_to);
end;
$$;

revoke all on function public.carry_stage_history(uuid, uuid) from public, anon;
grant execute on function public.carry_stage_history(uuid, uuid) to authenticated;

-- Library stages: same step on every job that uses the stage.
create or replace function public.move_candidates_off_library_stage(p_stage_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_target uuid;
  v_moved integer := 0;
  v_title text;
  v_result jsonb;
begin
  for r in
    select id, job_id, position
    from public.job_hiring_stages
    where stage_id = p_stage_id
    order by job_id, position
  loop
    select jhs.id into v_target
    from public.job_hiring_stages jhs
    where jhs.job_id = r.job_id
      and jhs.stage_id <> p_stage_id
      and jhs.position < r.position
    order by jhs.position desc
    limit 1;

    if v_target is null then
      select jhs.id into v_target
      from public.job_hiring_stages jhs
      where jhs.job_id = r.job_id
        and jhs.stage_id <> p_stage_id
        and jhs.position > r.position
      order by jhs.position asc
      limit 1;
    end if;

    if v_target is null then
      if exists (select 1 from public.job_candidate_associations a where a.current_stage_id = r.id)
         or exists (select 1 from public.job_stage_scorecards s where s.stage_instance_id = r.id) then
        select title into v_title from public.jobs where id = r.job_id;
        raise exception 'It is the only stage on %, which has candidates or scorecards in it. Add another stage to that job first.', coalesce(v_title, 'a job');
      end if;
    else
      v_result := public.carry_stage_history_internal(r.id, v_target);
      v_moved := v_moved + coalesce((v_result->>'candidates')::integer, 0);
    end if;
  end loop;
  return v_moved;
end;
$$;
