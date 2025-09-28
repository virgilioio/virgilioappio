-- Phase 1d: Comprehensive policy drop, enum update, and policy recreation

-- Drop ALL policies that reference member_role (public schema)
DROP POLICY IF EXISTS "Organization recruiters can manage application limits" ON public.candidate_application_limits;
DROP POLICY IF EXISTS "Users can update attachments for manageable candidates" ON public.candidate_attachments;
DROP POLICY IF EXISTS "Users can upload attachments for any manageable candidates" ON public.candidate_attachments;
DROP POLICY IF EXISTS "Users can create comments for manageable candidates" ON public.candidate_comments;
DROP POLICY IF EXISTS "Users can view comments for accessible candidates - fixed" ON public.candidate_comments;
DROP POLICY IF EXISTS "Organization members can view education" ON public.candidate_education;
DROP POLICY IF EXISTS "Organization recruiters can manage education" ON public.candidate_education;
DROP POLICY IF EXISTS "Organization members can view enrichment logs" ON public.candidate_enrichment_logs;
DROP POLICY IF EXISTS "Users can manage URLs for candidates they can manage" ON public.candidate_urls;
DROP POLICY IF EXISTS "Organization members can view work experience" ON public.candidate_work_experience;
DROP POLICY IF EXISTS "Organization recruiters can manage work experience" ON public.candidate_work_experience;
DROP POLICY IF EXISTS "Organization recruiters can manage candidates" ON public.candidates;
DROP POLICY IF EXISTS "Manage job assignments - insert" ON public.job_assignments;
DROP POLICY IF EXISTS "Organization admins can manage assignments in their org" ON public.job_assignments;
DROP POLICY IF EXISTS "Organization recruiters can manage associations" ON public.job_candidate_associations;
DROP POLICY IF EXISTS "Recruiters can insert associations (with check)" ON public.job_candidate_associations;
DROP POLICY IF EXISTS "Recruiters can update associations (with check)" ON public.job_candidate_associations;
DROP POLICY IF EXISTS "Organization recruiters can manage candidates" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_delete_comprehensive" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_insert_comprehensive" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_update_comprehensive" ON public.job_candidates;
DROP POLICY IF EXISTS "Manage job hiring stages - delete" ON public.job_hiring_stages;
DROP POLICY IF EXISTS "Manage job hiring stages - insert" ON public.job_hiring_stages;
DROP POLICY IF EXISTS "Manage job hiring stages - update" ON public.job_hiring_stages;
DROP POLICY IF EXISTS "Organization recruiters can delete hiring stages" ON public.job_hiring_stages;
DROP POLICY IF EXISTS "Organization recruiters can insert hiring stages" ON public.job_hiring_stages;
DROP POLICY IF EXISTS "Organization recruiters can update hiring stages" ON public.job_hiring_stages;
DROP POLICY IF EXISTS "Org recruiters can manage posting fields" ON public.job_posting_application_fields;
DROP POLICY IF EXISTS "Org recruiters can manage job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Organization admins can manage their jobs" ON public.jobs;
DROP POLICY IF EXISTS "Organization recruiters can manage offer letters" ON public.offer_letters;
DROP POLICY IF EXISTS "Platform admins can manage offer template fields" ON public.offer_template_fields;
DROP POLICY IF EXISTS "Platform admins can manage offer templates" ON public.offer_templates;
DROP POLICY IF EXISTS "Workspace owners can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Workspace owners can delete their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Workspace owners can update their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Workspace owners can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Org recruiters can manage posting select options" ON public.posting_field_select_options;
DROP POLICY IF EXISTS "Org recruiters can manage posting validation rules" ON public.posting_field_validation_rules;
DROP POLICY IF EXISTS "Customer success can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "tenant_admin_select_own" ON public.tenant_subscriptions;

-- Drop storage policies that reference member_role
DROP POLICY IF EXISTS "Authorized users can delete organization files" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can upload organization files" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can view organization files" ON storage.objects;
DROP POLICY IF EXISTS "Billing members can upload org invoices" ON storage.objects;
DROP POLICY IF EXISTS "Platform admins can view all organization files" ON storage.objects;