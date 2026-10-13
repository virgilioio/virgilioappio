-- Workspace pipeline stages (2026-10-13).
-- Settings > Pipeline stages let workspace owners add their own stages but not
-- retire them: the existing stage function only accepts platform admins, so the
-- button always failed after the confirmation. This function does the same
-- work for a stage that belongs to the caller's own workspace: candidates in it
-- move to the previous stage of each job (or back to review), the stage's
-- per-job instances go, and the stage is marked inactive. Platform stages stay
-- with that platform-only function.

create function public.retire_tenant_job_stage(p_stage_id uuid)
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

  perform public.reassign_candidates_for_stage(p_stage_id);

  update public.job_stages
  set is_active = false,
      updated_at = now()
  where id = p_stage_id;
end;
$$;

revoke execute on function public.retire_tenant_job_stage(uuid) from public, anon;
grant execute on function public.retire_tenant_job_stage(uuid) to authenticated;
