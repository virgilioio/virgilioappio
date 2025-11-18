-- Phase 3 (Fixed): Comprehensive Motive Account Deletion

-- This migration deletes all data related to the "Motive" tenant and allan.bravo@gomotive.com
-- Fixed: Proper deletion order to respect foreign key constraints

DO $$
DECLARE
  motive_tenant_id UUID := '7a35405a-46e9-4a59-8901-9770c34d4bfd';
  allan_user_id UUID := '39efb67d-309d-4032-ad5c-1d1c00b2d10d';
  deleted_counts JSONB := '{}'::JSONB;
  row_count INTEGER;
BEGIN
  -- Step 1: Delete activities
  DELETE FROM public.activities WHERE tenant_id = motive_tenant_id OR user_id = allan_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{activities}', to_jsonb(row_count));
  RAISE LOG 'Deleted % activities', row_count;

  -- Step 2: Delete job_candidate_associations (must come before jobs and candidates)
  DELETE FROM public.job_candidate_associations 
  WHERE job_id IN (SELECT id FROM public.jobs WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE tenant_id = motive_tenant_id
  ));
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{job_candidate_associations}', to_jsonb(row_count));
  RAISE LOG 'Deleted % job_candidate_associations', row_count;

  -- Step 3: Delete job postings
  DELETE FROM public.job_postings 
  WHERE job_id IN (SELECT id FROM public.jobs WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE tenant_id = motive_tenant_id
  ));
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{job_postings}', to_jsonb(row_count));
  RAISE LOG 'Deleted % job_postings', row_count;

  -- Step 4: Delete job hiring stages
  DELETE FROM public.job_hiring_stages 
  WHERE job_id IN (SELECT id FROM public.jobs WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE tenant_id = motive_tenant_id
  ));
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{job_hiring_stages}', to_jsonb(row_count));
  RAISE LOG 'Deleted % job_hiring_stages', row_count;

  -- Step 5: Delete jobs
  DELETE FROM public.jobs 
  WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE tenant_id = motive_tenant_id
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{jobs}', to_jsonb(row_count));
  RAISE LOG 'Deleted % jobs', row_count;

  -- Step 6: Delete coresignal preview candidates
  DELETE FROM public.coresignal_preview_candidates 
  WHERE sourcing_project_id IN (
    SELECT id FROM public.sourcing_projects WHERE organization_id IN (
      SELECT id FROM public.organizations WHERE tenant_id = motive_tenant_id
    )
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{coresignal_preview_candidates}', to_jsonb(row_count));
  RAISE LOG 'Deleted % coresignal_preview_candidates', row_count;

  -- Step 7: Delete sourcing projects
  DELETE FROM public.sourcing_projects 
  WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE tenant_id = motive_tenant_id
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{sourcing_projects}', to_jsonb(row_count));
  RAISE LOG 'Deleted % sourcing_projects', row_count;

  -- Step 8: Delete candidates (FIXED: delete by organization_id, not just tenant_id)
  DELETE FROM public.candidates 
  WHERE organization_id IN (
    SELECT id FROM public.organizations WHERE tenant_id = motive_tenant_id
  ) OR tenant_id = motive_tenant_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{candidates}', to_jsonb(row_count));
  RAISE LOG 'Deleted % candidates', row_count;

  -- Step 9: Delete CoreSignal usage
  DELETE FROM public.coresignal_usage WHERE tenant_id = motive_tenant_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{coresignal_usage}', to_jsonb(row_count));
  RAISE LOG 'Deleted % coresignal_usage records', row_count;

  -- Step 10: Delete members
  DELETE FROM public.members WHERE tenant_id = motive_tenant_id OR user_id = allan_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{members}', to_jsonb(row_count));
  RAISE LOG 'Deleted % members', row_count;

  -- Step 11: Delete child organizations (NOW safe after candidates are deleted)
  DELETE FROM public.organizations WHERE parent_organization_id IN (
    SELECT id FROM public.organizations WHERE tenant_id = motive_tenant_id
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{child_organizations}', to_jsonb(row_count));
  RAISE LOG 'Deleted % child_organizations', row_count;

  -- Step 12: Delete root organization
  DELETE FROM public.organizations WHERE tenant_id = motive_tenant_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{root_organization}', to_jsonb(row_count));
  RAISE LOG 'Deleted % root_organization', row_count;

  -- Step 13: Delete tenant subscription
  DELETE FROM public.tenant_subscriptions WHERE tenant_id = motive_tenant_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{tenant_subscriptions}', to_jsonb(row_count));
  RAISE LOG 'Deleted % tenant_subscriptions', row_count;

  -- Step 14: Delete tenant
  DELETE FROM public.tenants WHERE id = motive_tenant_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{tenants}', to_jsonb(row_count));
  RAISE LOG 'Deleted % tenants', row_count;

  -- Step 15: Delete profile
  DELETE FROM public.profiles WHERE user_id = allan_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{profiles}', to_jsonb(row_count));
  RAISE LOG 'Deleted % profiles', row_count;

  -- Step 16: Delete auth user
  DELETE FROM auth.users WHERE id = allan_user_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  deleted_counts := jsonb_set(deleted_counts, '{auth_users}', to_jsonb(row_count));
  RAISE LOG 'Deleted % auth_users', row_count;

  -- Final summary
  RAISE NOTICE 'Motive account deletion complete. Summary: %', deleted_counts;
END $$;
