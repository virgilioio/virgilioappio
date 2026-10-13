-- Removing a pipeline stage never takes candidates out of the pipeline (2026-10-13).
-- When a library stage is retired, every job that uses it loses that step. Until
-- now, candidates sitting in it moved to the step before, but when it was a
-- job's first step they were left with no stage at all, which hides them from
-- the job's board. Now they move to the step before; if there is none, to the
-- step after (the new first step). Only a job whose only step this was leaves
-- them without a stage, as before.
--
-- Platform stages get retire_global_job_stage (platform admins), which the app
-- now calls instead of the older platform function; workspace stages keep
-- retire_tenant_job_stage, which gains the same move.

-- Its search_path includes public because the stage-change trigger on
-- job_candidate_associations (log_candidate_stage_change) names its enum type
-- without a schema, and that trigger runs inside this function. Every name in
-- here is schema-qualified.
create function public.move_candidates_off_library_stage(p_stage_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_target uuid;
  v_moved integer := 0;
  v_n integer;
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

    if v_target is not null then
      update public.job_candidate_associations
      set current_stage_id = v_target,
          pipeline_position = null,
          updated_at = now()
      where current_stage_id = r.id;
      get diagnostics v_n = row_count;
      v_moved := v_moved + v_n;
    end if;
  end loop;
  return v_moved;
end;
$$;

revoke all on function public.move_candidates_off_library_stage(uuid) from public, anon, authenticated;

create function public.retire_global_job_stage(p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.get_user_type_secure() is distinct from 'platform_admin' then
    raise exception 'Only platform administrators can remove platform stages';
  end if;

  perform public.move_candidates_off_library_stage(p_stage_id);
  perform public.reassign_candidates_for_stage(p_stage_id);

  update public.job_stages
  set is_active = false,
      updated_at = now()
  where id = p_stage_id;
end;
$$;

revoke all on function public.retire_global_job_stage(uuid) from public, anon;
grant execute on function public.retire_global_job_stage(uuid) to authenticated;

create or replace function public.retire_tenant_job_stage(p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.job_stages where id = p_stage_id;
  if v_tenant is null then
    raise exception 'Only stages that belong to your workspace can be removed here';
  end if;
  if v_tenant is distinct from public.get_user_tenant_id()
     or not (public.user_is_workspace_owner_in_tenant(v_tenant) or public.is_platform_admin()) then
    raise exception 'Only workspace owners can remove this stage';
  end if;

  perform public.move_candidates_off_library_stage(p_stage_id);
  perform public.reassign_candidates_for_stage(p_stage_id);

  update public.job_stages
  set is_active = false,
      updated_at = now()
  where id = p_stage_id;
end;
$$;
