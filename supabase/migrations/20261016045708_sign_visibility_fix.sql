-- Gio Sign: visibility fix (build step 1, Allan approved Sign 2026-10-16).
-- user_has_tenant_access() also requires workspace-wide access, so TAs scoped
-- to their jobs and members who are recipients saw nothing. Sign checks plain
-- active membership instead, then its own rules (admin, sender, the job's team,
-- or recipient). Found by supabase/tests/06_sign_rls.sql.

create or replace function public.sign_can_view_envelope(_envelope_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.sign_envelopes e
    where e.id = _envelope_id
      and public.is_active_member(e.tenant_id)
      and (
        public.sign_is_admin(e.tenant_id)
        or e.created_by = auth.uid()
        or e.sender_user_id = auth.uid()
        or (e.ats_job_id is not null and e.ats_job_id in (select public.my_job_ids()))
        or exists (
          select 1 from public.sign_recipients r
          where r.envelope_id = e.id and r.removed_at is null
            and (r.user_id = auth.uid() or r.email = public.sign_my_email())
        )
      )
  );
$function$;

create or replace function public.sign_can_manage_envelope(_envelope_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.sign_envelopes e
    where e.id = _envelope_id
      and e.origin = 'ats'
      and public.is_active_member(e.tenant_id)
      and (public.sign_is_admin(e.tenant_id) or e.sender_user_id = auth.uid())
  );
$function$;

create or replace function public.sign_set_draft_removed(_envelope_id uuid, _removed boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.sign_envelopes e
    where e.id = _envelope_id and e.status = 'draft'
      and public.is_active_member(e.tenant_id)
      and (public.sign_is_admin(e.tenant_id) or e.sender_user_id = auth.uid())
  ) then
    raise exception 'Only drafts you can manage can be removed.' using errcode = 'GSN07';
  end if;
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes
     set deleted_at = case when _removed then now() else null end,
         deleted_by = case when _removed then auth.uid() else null end
   where id = _envelope_id;
end;
$function$;

alter policy sign_prefs_read on public.sign_notification_prefs
  using (email = public.sign_my_email() and public.is_active_member(tenant_id));
alter policy sign_prefs_insert on public.sign_notification_prefs
  with check (email = public.sign_my_email() and public.is_active_member(tenant_id));
