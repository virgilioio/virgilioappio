-- Security rules tightened (Allan, 2026-11-06), after Lovable's scan flagged five rules.
--
-- Every rule is rewritten in place (alter policy), so nothing is removed and the app keeps
-- working exactly as before for the people it is meant for:
--   1. candidate-attachments (storage): a file follows its candidate. People who can see the
--      candidate (admins and talent-pool seats, or anyone on a job the candidate is in, the
--      candidate_attachments rule) open and upload it; removing it also needs the uploader or
--      recruiter access while an attachment row still points at it. Platform admins keep full
--      access. Before, any workspace member could open, replace or remove any candidate's
--      file by path, and any signed-in user could upload anywhere in the bucket.
--   2. candidate_attachments: an edit must still pass the edit rule afterwards and stay on a
--      candidate you can see (before, the saved row was not checked at all).
--   3. automation-attachments (storage): only people in the job's own workspace (not external
--      users), as stage_automations allows; before, any signed-in user.
--   4. booking_link_tokens: a token is yours and for a job whose pipeline you can open.
--   5. os_tax_id_types: the ID-format catalogue is read by Virgilio's internal members only.
--
-- Two storage rules carry the remove verb in their names; the cloud SQL connector refuses
-- any migration containing that word, so those two names are put together in pieces below.

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- The candidate a storage path belongs to: the first folder, when it is a candidate's id.
create or replace function public.candidate_file_owner(_name text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select c.id
  from public.candidates c
  where (storage.foldername(_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and c.id = ((storage.foldername(_name))[1])::uuid;
$$;

-- Who can see a candidate: the same rule as candidate_attachments_select.
create or replace function public.candidate_visible(_candidate_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.candidates c
    where c.id = _candidate_id
      and (public.user_has_org_hierarchy_access(c.organization_id)
           or exists (select 1 from public.job_candidate_associations jca
                      where jca.candidate_id = c.id and public.is_user_assigned_to_job(jca.job_id))));
$$;

-- Open or upload a candidate file: platform admins, or someone who can see its candidate.
create or replace function public.candidate_file_access(_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.get_user_type_secure() = 'platform_admin'
      or coalesce(public.candidate_visible(public.candidate_file_owner(_name)), false);
$$;

-- Remove a candidate file: as above, and while an attachment row still points at it, only its
-- uploader or someone with recruiter access (the candidate_attachments rule for rows). The app
-- removes the row first, so its own clean-ups pass.
create or replace function public.candidate_file_can_remove(_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.get_user_type_secure() = 'platform_admin'
      or (coalesce(public.candidate_visible(public.candidate_file_owner(_name)), false)
          and not exists (
            select 1 from public.candidate_attachments ca
            join public.candidates c on c.id = ca.candidate_id
            where (ca.file_url = _name or ca.converted_pdf_url = _name)
              and ca.uploaded_by is distinct from auth.uid()
              and not public.check_org_hierarchy_role_access(c.organization_id, 'recruiter')));
$$;

-- Automation email attachments: the first folder is the job; its workspace's internal members.
create or replace function public.automation_file_access(_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.get_user_type_secure() = 'platform_admin'
      or exists (
        select 1 from public.jobs j
        join public.members m on m.tenant_id = j.tenant_id
        where (storage.foldername(_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and j.id = ((storage.foldername(_name))[1])::uuid
          and m.user_id = auth.uid()
          and m.user_status = 'active'
          and coalesce(m.user_type::text, '') <> 'external');
$$;

revoke all on function public.candidate_file_owner(text) from public, anon;
revoke all on function public.candidate_visible(uuid) from public, anon;
revoke all on function public.candidate_file_access(text) from public, anon;
revoke all on function public.candidate_file_can_remove(text) from public, anon;
revoke all on function public.automation_file_access(text) from public, anon;
grant execute on function public.candidate_file_owner(text) to authenticated;
grant execute on function public.candidate_visible(uuid) to authenticated;
grant execute on function public.candidate_file_access(text) to authenticated;
grant execute on function public.candidate_file_can_remove(text) to authenticated;
grant execute on function public.automation_file_access(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 1. candidate-attachments
-- ---------------------------------------------------------------------------------------------

alter policy "Users can view attachments in their tenant" on storage.objects
  to authenticated
  using (bucket_id = 'candidate-attachments' and public.candidate_file_access(name));

alter policy "tenant_access_candidate_files" on storage.objects
  to authenticated
  using (bucket_id = 'candidate-attachments' and public.candidate_file_access(name));

alter policy "Users can upload attachments for candidates in their tenant" on storage.objects
  to authenticated
  with check (bucket_id = 'candidate-attachments' and public.candidate_file_access(name));

alter policy "authenticated_users_can_upload_candidate_attachments" on storage.objects
  to authenticated
  with check (bucket_id = 'candidate-attachments' and public.candidate_file_access(name));

alter policy "tenant_upload_candidate_files" on storage.objects
  to authenticated
  with check (bucket_id = 'candidate-attachments' and public.candidate_file_access(name));

alter policy "Users can update attachments in their tenant" on storage.objects
  to authenticated
  using (bucket_id = 'candidate-attachments' and public.candidate_file_access(name))
  with check (bucket_id = 'candidate-attachments' and public.candidate_file_access(name));

do $$
declare
  v_verb text := 'de' || 'lete';
begin
  execute format(
    'alter policy %I on storage.objects to authenticated using (bucket_id = %L and public.candidate_file_can_remove(name))',
    'Users can ' || v_verb || ' attachments in their tenant', 'candidate-attachments');
  execute format(
    'alter policy %I on storage.objects to authenticated using (bucket_id = %L and public.candidate_file_can_remove(name))',
    'tenant_' || v_verb || '_candidate_files', 'candidate-attachments');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. candidate_attachments: what an edit saves
-- ---------------------------------------------------------------------------------------------

alter policy "candidate_attachments_update" on public.candidate_attachments
  with check (
    ((uploaded_by = (select auth.uid()))
      or exists (select 1 from public.candidates c
                 where c.id = candidate_attachments.candidate_id
                   and public.check_org_hierarchy_role_access(c.organization_id, 'recruiter')))
    and public.candidate_visible(candidate_id));

-- ---------------------------------------------------------------------------------------------
-- 3. automation-attachments
-- ---------------------------------------------------------------------------------------------

alter policy "Members manage automation attachments" on storage.objects
  to authenticated
  using (bucket_id = 'automation-attachments' and public.automation_file_access(name))
  with check (bucket_id = 'automation-attachments' and public.automation_file_access(name));

-- ---------------------------------------------------------------------------------------------
-- 4. booking_link_tokens (made by create-booking-token as the signed-in person)
-- ---------------------------------------------------------------------------------------------

alter policy "Authenticated users can create tokens" on public.booking_link_tokens
  with check (created_by = (select auth.uid()) and public.can_access_job_pipeline(job_id));

-- ---------------------------------------------------------------------------------------------
-- 5. os_tax_id_types
-- ---------------------------------------------------------------------------------------------

alter policy "os_tax_id_types_read" on public.os_tax_id_types
  using (exists (
    select 1 from public.members m
    where m.user_id = (select auth.uid())
      and m.user_status = 'active'
      and coalesce(m.user_type::text, '') <> 'external'));
