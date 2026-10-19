-- One recruiting library, edited by the workspace's admins (Allan, 2026-10-19)
--
-- The ATS isn't sold any more: there is one workspace, Virgilio's. Pipeline
-- stages, application fields and the templates (offer forms and their fields,
-- email templates, rejection reasons, rejection emails, candidate sources) were
-- split into "platform" rows (no workspace) that only platform admins could
-- edit, and the workspace's own rows that only a workspace owner could edit
-- (Virgilio has none; its two admins could edit neither). Settings › Recruiting
-- becomes the one place for all of it, as one list each.
--
-- library_editor(): a platform admin, or an owner or admin of Virgilio's
-- workspace (is_ats_admin). Library editors manage the shared rows and
-- Virgilio's own rows on each of these tables; rows of other (dormant)
-- workspaces stay out of reach. Every existing policy stays; this only adds.
-- Reading is unchanged.

-- Virgilio's workspace: its tenant and its organization share this id.
create or replace function public.library_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_ats_admin('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid);
$$;

revoke all on function public.library_editor() from public, anon;
grant execute on function public.library_editor() to authenticated;

comment on function public.library_editor() is
  'True for a platform admin or an owner/admin of Virgilio''s workspace: they edit the recruiting library (stages, application fields, templates).';

-- Tables scoped by tenant_id.
create policy job_stages_library_editor on public.job_stages
  for all to authenticated
  using ((tenant_id is null or tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab') and public.library_editor())
  with check ((tenant_id is null or tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab') and public.library_editor());

create policy application_fields_library_editor on public.application_fields
  for all to authenticated
  using ((tenant_id is null or tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab') and public.library_editor())
  with check ((tenant_id is null or tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab') and public.library_editor());

create policy offer_forms_library_editor on public.offer_forms
  for all to authenticated
  using ((tenant_id is null or tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab') and public.library_editor())
  with check ((tenant_id is null or tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab') and public.library_editor());

create policy rejection_reasons_library_editor on public.rejection_reasons
  for all to authenticated
  using ((tenant_id is null or tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab') and public.library_editor())
  with check ((tenant_id is null or tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab') and public.library_editor());

create policy rejection_email_templates_library_editor on public.rejection_email_templates
  for all to authenticated
  using ((tenant_id is null or tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab') and public.library_editor())
  with check ((tenant_id is null or tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab') and public.library_editor());

create policy candidate_sources_library_editor on public.candidate_sources
  for all to authenticated
  using ((tenant_id is null or tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab') and public.library_editor())
  with check ((tenant_id is null or tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab') and public.library_editor());

-- Email templates are scoped by organization_id.
create policy email_templates_library_editor on public.email_templates
  for all to authenticated
  using ((organization_id is null or organization_id = '5ba7b145-f251-4b18-8900-724cb06028ab') and public.library_editor())
  with check ((organization_id is null or organization_id = '5ba7b145-f251-4b18-8900-724cb06028ab') and public.library_editor());

-- An offer form's fields and their choices follow the form.
create policy offer_form_fields_library_editor on public.offer_form_fields
  for all to authenticated
  using (public.library_editor() and exists (
    select 1 from public.offer_forms f
    where f.id = offer_form_fields.form_id
      and (f.tenant_id is null or f.tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab')))
  with check (public.library_editor() and exists (
    select 1 from public.offer_forms f
    where f.id = offer_form_fields.form_id
      and (f.tenant_id is null or f.tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab')));

create policy offer_field_select_options_library_editor on public.offer_field_select_options
  for all to authenticated
  using (public.library_editor() and exists (
    select 1 from public.offer_form_fields ff join public.offer_forms f on f.id = ff.form_id
    where ff.id = offer_field_select_options.offer_field_id
      and (f.tenant_id is null or f.tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab')))
  with check (public.library_editor() and exists (
    select 1 from public.offer_form_fields ff join public.offer_forms f on f.id = ff.form_id
    where ff.id = offer_field_select_options.offer_field_id
      and (f.tenant_id is null or f.tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab')));
