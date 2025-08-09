
-- 1) Reassign candidates for a removed global stage across all jobs
create or replace function public.reassign_candidates_for_stage(stage_id_param uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  r record;
  prev_jhs_id uuid;
begin
  -- For each hiring stage instance that uses this global stage
  for r in
    select id, job_id, position
    from public.job_hiring_stages
    where stage_id = stage_id_param
    order by job_id, position
  loop
    -- Find the previous remaining stage in the same job (by position)
    select jhs.id
      into prev_jhs_id
    from public.job_hiring_stages jhs
    where jhs.job_id = r.job_id
      and jhs.position < r.position
      and jhs.stage_id <> stage_id_param
    order by jhs.position desc
    limit 1;

    if prev_jhs_id is not null then
      -- Move candidates to the previous stage and reset pipeline position
      update public.job_candidate_associations
      set current_stage_id = prev_jhs_id,
          pipeline_position = null,
          updated_at = now()
      where current_stage_id = r.id;
    else
      -- If this was the first stage, move candidates to "Application Review"
      -- represented by NULL stage (out-of-pipeline)
      update public.job_candidate_associations
      set current_stage_id = null,
          pipeline_position = null,
          updated_at = now()
      where current_stage_id = r.id;
    end if;
  end loop;

  -- Remove the hiring stage instances for this global stage
  delete from public.job_hiring_stages
  where stage_id = stage_id_param;
end;
$$;

-- 2) Safe, admin-only delete that performs reassignment then deactivates the global stage
create or replace function public.soft_delete_job_stage(stage_id_param uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- Only platform admins can perform global stage deletion
  if public.get_user_type_secure() <> 'platform_admin' then
    raise exception 'Only platform administrators can delete job stages';
  end if;

  -- Reassign candidates and remove per-job stage instances
  perform public.reassign_candidates_for_stage(stage_id_param);

  -- Soft delete the global stage
  update public.job_stages
  set is_active = false,
      updated_at = now()
  where id = stage_id_param;
end;
$$;

-- 3) Trigger to catch any manual deactivation of a stage and ensure reassignment runs
create or replace function public.on_job_stage_deactivated()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if old.is_active = true and new.is_active = false then
    perform public.reassign_candidates_for_stage(old.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_job_stage_deactivated on public.job_stages;

create trigger trg_job_stage_deactivated
before update of is_active on public.job_stages
for each row
when (old.is_active = true and new.is_active = false)
execute function public.on_job_stage_deactivated();
