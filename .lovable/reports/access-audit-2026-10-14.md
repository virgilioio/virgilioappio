# ATS access audit — 2026-10-14

Read-only audit of project `etrxjxstjfcozdjumfsj` for job-based access (design doc "Gio OS: People & Access", Part C). Snapshot as of 2026-10-14, before Part C. Items marked **fixed** shipped the same day (migrations `20261014171939_security_hotfix_1`, `20261014172400_job_team_admin_only`, and the edge-function guard `_shared/recordAccess.ts`).

Target rules: admins and platform admins see everything; TA (recruiter) or Sourcer on a draft/open job sees the whole talent pool plus their jobs; hiring managers and interviewers see only their job's pipeline; closed/archived jobs are read-only for their team; no job means nothing.

## Member-wide helpers (the root cause)

- `user_has_tenant_access(tenant)` — true for any active member.
- `check_org_hierarchy_role_access(org, 'recruiter'|'interviewer')` — true for `system_role in ('admin','member')`.
- `user_has_org_hierarchy_access(org)` — walks parent + sibling orgs, so it equals tenant membership.
- `is_user_assigned_to_job` and inline `job_assignments` checks ignore `deleted_at`, `role` and `jobs.status`.
- Only `can_access_chat_thread` is job-based today (excludes sourcers; closed jobs not read-only).

## 1. Talent pool (admins, or TA/Sourcer on an active job)

| Table | Member-wide grant today |
|---|---|
| candidates | `candidates_select_consolidated`: `user_has_tenant_access` OR assigned job (HM/interviewer still need "candidate in my job") |
| candidate_work_experience, candidate_education, candidate_certifications | select/insert/update/delete via `user_has_tenant_access` |
| candidate_attachments | `user_has_org_hierarchy_access` OR assigned job |
| candidate_urls | org membership (all four commands) |
| person_identities, candidate_duplicate_decisions, candidate_tags, tags | `user_has_tenant_access` |
| candidate_lists, candidate_list_items, candidate_list_messages, candidate_list_reviewers | `user_has_tenant_access` |
| candidate_transfers | `user_has_tenant_access(target_tenant_id)` |
| sourcing_projects, sourcing_project_collaborators | creator OR (`is_public` AND org hierarchy) |
| sourcing_project_candidates, talent_pool_runs, apollo_credit_ledger | `user_has_tenant_access` |
| sourcing_preview_candidates | tenant member join |
| candidate_comments, candidate_reminders | mixed: job_id optional (null → talent pool, set → job-scoped) |

## 2. Job-scoped (link to job)

| Table | Link | Member-wide grant today |
|---|---|---|
| jobs | id | `check_org_hierarchy_role_access(org,'recruiter')` |
| job_assignments | job_id | "Admins and members can view org assignments" (writes **fixed**: `can_manage_job_team`) |
| job_candidate_associations | job_id | org hierarchy / org member |
| job_candidate_stage_history | association → job | org member |
| stage_events | job_id | `user_has_tenant_access` |
| job_hiring_stages, stage_interviewer_assignments, stage_scorecard_templates, scorecard_interview_questions | job / stage → job | org hierarchy / recruiter role check |
| job_stage_scorecards | job_id | org member (cross-tenant always-true clause **fixed**) |
| scorecard_question_responses, validation_point_resolutions, scorecard_reminder_sends | scorecard / association → job | org hierarchy / tenant |
| fit_score_history, job_openings, scheduled_booking_attendees, stage_automation_runs | parent row | follow parent |
| job_briefings, job_pipeline_shares, job_suggested_candidates_cache, job_sales_lines | job_id | `user_has_tenant_access` (suggestions cache = talent pool content) |
| job_suggestion_dismissals | job_id | `can_access_job_pipeline` (org hierarchy) |
| job_postings, job_posting_application_fields, posting_field_select_options | job_id | org member + public read of active postings |
| candidate_application_responses, candidate_application_limits | job_id | org / tenant member |
| offer_letters, offer_approval_requests, offer_approval_request_steps, offer_approval_chains(+steps) | job_id | org member / role checks (chains with null job_id are templates) |
| reference_requests, reference_referees, reference_activity | job_id / request | `tenant_id = get_user_tenant_id()` (LIMIT 1) |
| chat_threads, chat_messages, chat_access_tokens | job_id | `can_access_chat_thread` (already job-based) |
| scheduled_bookings, booking_link_tokens | job_id / association | tenant member; booking_link_tokens INSERT `true` |
| scheduled_emails | association / job | ALL for any tenant member |
| email_logs | job_id optional | org hierarchy OR assigned (mixed) |
| automation_email_queue | association | org member |
| stage_automations, stage_automation_emails | stage → job | tenant member, read and ALL |
| dossier_shares, dossier_feedback | association | `dossier_share_can_manage` (org hierarchy) |
| onboarding_tasks | application → association | `user_has_tenant_access` |

## 3. Admin-only

Readable by members (needed by the app), admin write: job_stages, application_fields, contract/offer templates and forms, email_templates, rejection templates/reasons, reference_templates, candidate_sources, departments, careers_page_settings, workspace_automations, job_board_integrations, tenant_domains, members, profiles, organizations, tenants, currencies.

Members can write today (Part C): candidate_sources, currency_rates, currency_rate_overrides, stage_automations, email_suppression_list.

Billing/credits readable by members today: credit_purchases, sourcing_credits_usage, apollo_credit_plans, chat_ai_token_usage, email_rate_limits. tenant_subscriptions is owner-only.

Already restricted: audit_logs, tenant_access_grants, tenant_fraud_signals, tenant_notes, failed_job_board_applications, `_archived_*` (platform admin); candidate_eeo_responses, chat_audit_log, integration_outbox (admin/owner).

Legacy CRM tables in the ATS: deals, deal_stages, deal_payments (`user_is_crm_admin_in_tenant`); deal_invoices, deal_notes, company_contacts readable by every member.

## 4. Personal

Own rows: notifications, notification_preferences, push_subscriptions, dashboard_queue_dismissals, chat_thread_reads, user_mail_identities, calendar_identities, booking_configurations, booking_event_types, onboarding_progress, subscribers, password_reset_tokens, activities, saved_views (shared views readable by members).

**Not personal today (Part C):** ai_conversations / conversation_messages are readable by every tenant member.

## 5. Public, system, server-only

Shared reference data (`true`): standard_job_titles, standard_locations, standard_skills. Deny-all / service only: integration_inbox, stripe_webhook_events, chat_rate_limits, fit_analysis_queue(+control), platform_feature_flags, privacy_requests, privacy_suppressions, req_id_counters, chat_messages partitions. Public pages go through token-based functions (dossier-public, pipeline-public, reference-public, talent-questions).

## Edge functions returning candidate/job data to a user

| Function | Check before 2026-10-14 | Now |
|---|---|---|
| get-job-matching-candidates, count-matching-candidates, generate-next-steps, extract-candidate-skills, generate-scorecard-questions | none (public key enough) | **fixed**: `checkRecordAccess` |
| analyze-candidate-fit | JWT role only | **fixed** |
| get-suggested-candidates, generate-email-draft | sign-in only | **fixed** |
| request-scorecard | optional sign-in | Part C |
| sourcing-search, shortlist-ai-fit, search-apollo-candidates, enrich-apollo-profile, enrich-by-linkedin, refresh-candidate-profiles | membership | Part C: talent-pool rule |
| create-sourcing-project(-from-job), refine-sourcing-project | sign-in; job read with service key | Part C |
| chrome-api-* | member row | Part C |
| merge-candidates, get-duplicate-context | admin or member | Part C |
| chat-ai-* | user-client RLS | OK; add sourcers + closed jobs |
| download-attachment, generate-job-briefing, job-briefing-snapshot | user-client RLS first | follow table rules |

## SECURITY DEFINER functions

- **Fixed** (anon/authenticated revoked or guarded): encrypt/decrypt_refresh_token, emit_notification, chat_bell_enqueue, purge_expired_chat_threads, get_stage_deletion_impact, get_candidate_tenant_id, should_stop_automation; get_pipeline_job_metrics now signed-in only.
- Still callable by anon, needed by public pages: check_application_limits, dossier_share_is_live.
- No caller check (signed-in): job_opening_active_offer, resolve_client_verdict, job_setup_checks.
- Tenant-membership only, skip the check when `auth.uid()` is null: search_candidates, market_talent_rows, market_past_companies, find_candidate_matches, possible_duplicate_pairs, get_candidates_awaiting_outreach; also get_candidate_kpis, create_candidate_list_with_reviewers.
- Org-hierarchy: get_candidate_activities, dossier_share_can_manage, can_access_job_pipeline.
- get_pipeline_global_metrics: any assignment, ignores role/deleted/status, excludes admins.

## Still open outside Part C

- Google refresh tokens are encrypted with the fallback key (`app.encryption_key` is not set). Fix: a key in Supabase Vault, re-encrypt the 19 mail tokens and calendar tokens, then remove the fallback.
- 40 of 127 recruiter seats belong to people who are also stage interviewers on the same job (stage interviewers used to join as recruiters). 12 recruiter seats are on active jobs: review before Part C goes live.
