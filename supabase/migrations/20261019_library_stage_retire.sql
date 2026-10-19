-- Removing a library stage, for library editors (Allan, 2026-10-19)
--
-- 20261019040505_library_editors let Virgilio's admins edit the recruiting
-- library, but taking a stage out goes through two functions with their own
-- checks: retire_global_job_stage (platform admins only) and
-- retire_tenant_job_stage (workspace owners only; Virgilio has none). Both now
-- also accept a library editor, for the shared stages and Virgilio's own.
-- Everything else is as before: candidates in the stage move to the stage
-- before on each job (or the stage after when it was first), and the stage is
-- marked inactive, never removed.

create or replace function public.retire_global_job_stage(p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if public.get_user_type_secure() is distinct from 'platform_admin' and not public.library_editor() then
    raise exception 'Only platform administrators and workspace admins can remove library stages';
  end if;

  perform public.move_candidates_off_library_stage(p_stage_id);
  perform public.reassign_candidates_for_stage(p_stage_id);

  update public.job_stages
  set is_active = false,
      updated_at = now()
  where id = p_stage_id;
end;
$function$;

create or replace function public.retire_tenant_job_stage(p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.job_stages where id = p_stage_id;
  if v_tenant is null then
    raise exception 'Only stages that belong to your workspace can be removed here';
  end if;
  if not (
    (v_tenant = public.get_user_tenant_id()
      and (public.user_is_workspace_owner_in_tenant(v_tenant) or public.is_platform_admin()))
    or (v_tenant = '5ba7b145-f251-4b18-8900-724cb06028ab'::uuid and public.library_editor())
  ) then
    raise exception 'Only workspace owners and admins can remove this stage';
  end if;

  perform public.move_candidates_off_library_stage(p_stage_id);
  perform public.reassign_candidates_for_stage(p_stage_id);

  update public.job_stages
  set is_active = false,
      updated_at = now()
  where id = p_stage_id;
end;
$function$;
