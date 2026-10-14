-- Security hotfix 1 (2026-10-14), from the access audit in the
-- "Gio OS: People & Access design" doc. No change for signed-in users who
-- use the app normally; this only closes paths that bypass it.

-- 1. Scorecards: the assignment clause compared ja.job_id with itself, so
--    anyone with any job assignment could read every scorecard in every
--    workspace. It now matches the scorecard's own job, ignoring removed
--    assignments. The other clauses are unchanged.
alter policy "Users can view accessible scorecards" on public.job_stage_scorecards
  using (
    (created_by = (select auth.uid()))
    or (public.get_user_type_secure() = 'platform_admin'::text)
    or exists (
      select 1
      from public.members m
      join public.jobs j on j.organization_id = m.organization_id
      where j.id = job_stage_scorecards.job_id
        and m.user_id = (select auth.uid())
        and m.user_status = 'active'::text
    )
    or exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = job_stage_scorecards.job_id
        and ja.user_id = (select auth.uid())
        and ja.deleted_at is null
    )
  );

-- 2. Server-only functions: nobody outside the server may call them.
--    Their only callers are edge functions with the service role and other
--    SECURITY DEFINER functions owned by postgres.
revoke execute on function public.encrypt_refresh_token(text) from public, anon, authenticated;
revoke execute on function public.emit_notification(uuid,uuid,public.notification_category,uuid,text,text,text,text,text,text,uuid,uuid,uuid,text,jsonb) from public, anon, authenticated;
revoke execute on function public.chat_bell_enqueue(uuid,uuid,uuid,text,uuid,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.purge_expired_chat_threads() from public, anon, authenticated;
revoke execute on function public.get_stage_deletion_impact(uuid) from public, anon, authenticated;
revoke execute on function public.get_candidate_tenant_id(uuid) from public, anon, authenticated;
revoke execute on function public.should_stop_automation(uuid,uuid) from public, anon, authenticated;

grant execute on function public.encrypt_refresh_token(text) to service_role;
grant execute on function public.emit_notification(uuid,uuid,public.notification_category,uuid,text,text,text,text,text,text,uuid,uuid,uuid,text,jsonb) to service_role;
grant execute on function public.chat_bell_enqueue(uuid,uuid,uuid,text,uuid,text,text,text,text) to service_role;
grant execute on function public.purge_expired_chat_threads() to service_role;
grant execute on function public.get_stage_deletion_impact(uuid) to service_role;
grant execute on function public.get_candidate_tenant_id(uuid) to service_role;
grant execute on function public.should_stop_automation(uuid,uuid) to service_role;

-- 3. Signed-in only: the app calls these from the browser.
revoke execute on function public.get_pipeline_job_metrics(uuid[]) from public, anon;
grant execute on function public.get_pipeline_job_metrics(uuid[]) to authenticated, service_role;

-- 4. Google refresh tokens: only the server, the token's owner or a platform
--    admin may decrypt one. Those are the only people who can read the
--    encrypted value today, so every current caller keeps working.
create or replace function public.decrypt_refresh_token(encrypted_token text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  encryption_key text;
begin
  if encrypted_token is null then
    return null;
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
     and public.get_user_type_secure() is distinct from 'platform_admin'
     and not exists (
       select 1 from public.user_mail_identities
       where user_id = auth.uid() and refresh_token_encrypted = encrypted_token
     )
     and not exists (
       select 1 from public.calendar_identities
       where user_id = auth.uid() and encrypted_refresh_token = encrypted_token
     )
  then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  encryption_key := coalesce(
    current_setting('app.encryption_key', true),
    'default-encryption-key-change-in-production'
  );

  return pgp_sym_decrypt(decode(encrypted_token, 'base64'), encryption_key);
end;
$function$;

revoke execute on function public.decrypt_refresh_token(text) from public, anon;
grant execute on function public.decrypt_refresh_token(text) to authenticated, service_role;
