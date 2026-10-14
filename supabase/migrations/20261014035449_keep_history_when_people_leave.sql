-- Keep the history when a person's account is removed (2026-10-13).
-- These columns record who did something: uploaded a file, booked a meeting,
-- last edited a job, owns a workspace. They pointed at auth.users with no
-- delete rule, so removing anyone who had done real work failed: before
-- 2026-10-13 it left them half-removed, and since then delete-user refuses
-- (user_deletion_blockers). Now the row stays and the "who" becomes empty,
-- which every one of these columns already allows.
--
-- Not changed, so they still block removal and delete-user says why:
--   scheduled_bookings.interviewer_id   (the host of an interview or meeting)
--   sourcing_projects.created_by        (the project's owner)
--   sourcing_project_collaborators.added_by
--   tenant_domains.added_by
-- All four are required columns; emptying them needs a product decision.

alter table audit.download_logs
  drop constraint download_logs_user_id_fkey,
  add constraint download_logs_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;

alter table public.candidate_attachments
  drop constraint candidate_attachments_uploaded_by_fkey,
  add constraint candidate_attachments_uploaded_by_fkey
    foreign key (uploaded_by) references auth.users(id) on delete set null;

alter table public.candidate_urls
  drop constraint candidate_urls_created_by_fkey,
  add constraint candidate_urls_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.careers_page_settings
  drop constraint careers_page_settings_created_by_fkey,
  add constraint careers_page_settings_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.credit_purchases
  drop constraint credit_purchases_purchased_by_fkey,
  add constraint credit_purchases_purchased_by_fkey
    foreign key (purchased_by) references auth.users(id) on delete set null;

alter table public.dossier_shares
  drop constraint dossier_shares_created_by_fkey,
  add constraint dossier_shares_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.invitations
  drop constraint invitations_invited_by_fkey,
  add constraint invitations_invited_by_fkey
    foreign key (invited_by) references auth.users(id) on delete set null;

alter table public.job_assignments
  drop constraint job_assignments_assigned_by_fkey,
  add constraint job_assignments_assigned_by_fkey
    foreign key (assigned_by) references auth.users(id) on delete set null;

alter table public.job_board_integrations
  drop constraint job_board_integrations_created_by_fkey,
  add constraint job_board_integrations_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.job_candidate_associations
  drop constraint job_candidate_associations_hired_by_fkey,
  add constraint job_candidate_associations_hired_by_fkey
    foreign key (hired_by) references auth.users(id) on delete set null,
  drop constraint job_candidate_associations_offered_by_fkey,
  add constraint job_candidate_associations_offered_by_fkey
    foreign key (offered_by) references auth.users(id) on delete set null;

alter table public.job_openings
  drop constraint job_openings_recruiter_user_id_fkey,
  add constraint job_openings_recruiter_user_id_fkey
    foreign key (recruiter_user_id) references auth.users(id) on delete set null,
  drop constraint job_openings_sourcer_user_id_fkey,
  add constraint job_openings_sourcer_user_id_fkey
    foreign key (sourcer_user_id) references auth.users(id) on delete set null;

alter table public.jobs
  drop constraint jobs_last_edited_by_fkey,
  add constraint jobs_last_edited_by_fkey
    foreign key (last_edited_by) references auth.users(id) on delete set null;

alter table public.offer_letters
  drop constraint offer_letters_created_by_fkey,
  add constraint offer_letters_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.organizations
  drop constraint organizations_created_by_fkey,
  add constraint organizations_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.rejection_email_templates
  drop constraint rejection_email_templates_created_by_fkey,
  add constraint rejection_email_templates_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.rejection_reasons
  drop constraint rejection_reasons_created_by_fkey,
  add constraint rejection_reasons_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.scheduled_bookings
  drop constraint scheduled_bookings_booked_by_fkey,
  add constraint scheduled_bookings_booked_by_fkey
    foreign key (booked_by) references auth.users(id) on delete set null,
  drop constraint scheduled_bookings_cancelled_by_fkey,
  add constraint scheduled_bookings_cancelled_by_fkey
    foreign key (cancelled_by) references auth.users(id) on delete set null;

alter table public.stage_automations
  drop constraint stage_automations_created_by_fkey,
  add constraint stage_automations_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.stage_scorecard_templates
  drop constraint stage_scorecard_templates_created_by_fkey,
  add constraint stage_scorecard_templates_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.tenant_domains
  drop constraint tenant_domains_verified_by_fkey,
  add constraint tenant_domains_verified_by_fkey
    foreign key (verified_by) references auth.users(id) on delete set null;

alter table public.tenants
  drop constraint tenants_owner_id_fkey,
  add constraint tenants_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete set null;
