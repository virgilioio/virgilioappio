-- Comprehensive cleanup: Delete all data for allan.bravo@gomotive.com and Motive tenant
-- User ID: 4c7a9aa0-cf11-4bfc-b79e-f2871e57c659
-- Tenant ID: 0d3834bb-dab6-481d-8cba-90ec6b5bf8bf

-- Step 1: Delete dependent data (sourcing projects)
DELETE FROM public.sourcing_projects 
WHERE id = '7344dd91-64e6-4710-984d-f60b7a81fc79';

-- Step 2: Delete careers page settings
DELETE FROM public.careers_page_settings 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 3: Delete booking configurations
DELETE FROM public.booking_configurations 
WHERE organization_id IN (
  '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf',  -- Motive root org
  '31bd9eb1-c066-4e68-b92f-e7c5816ea659',  -- Sales child org
  'aca55e64-c41b-4dd4-b07c-edf4ac33b66d'   -- People child org
);

-- Step 4: Delete coresignal usage
DELETE FROM public.coresignal_usage 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 5: Delete calendar identities
DELETE FROM public.calendar_identities 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 6: Delete user mail identities
DELETE FROM public.user_mail_identities 
WHERE user_id = '4c7a9aa0-cf11-4bfc-b79e-f2871e57c659';

-- Step 7: Delete onboarding progress
DELETE FROM public.onboarding_progress 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 8: Delete activities
DELETE FROM public.activities 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 9: Delete email rate limits
DELETE FROM public.email_rate_limits 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 10: Delete email suppression list
DELETE FROM public.email_suppression_list 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 11: Delete AI conversations
DELETE FROM public.ai_conversations 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 12: Delete application fields
DELETE FROM public.application_fields 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 13: Delete contract templates
DELETE FROM public.contract_templates 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 14: Delete job board integrations
DELETE FROM public.job_board_integrations 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 15: Delete email logs
DELETE FROM public.email_logs 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 16: Delete candidates
DELETE FROM public.candidates 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 17: Delete members
DELETE FROM public.members 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 18: Delete profile
DELETE FROM public.profiles 
WHERE user_id = '4c7a9aa0-cf11-4bfc-b79e-f2871e57c659';

-- Step 19: Delete tenant subscription
DELETE FROM public.tenant_subscriptions 
WHERE tenant_id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 20: Delete child organizations first
DELETE FROM public.organizations 
WHERE id IN (
  '31bd9eb1-c066-4e68-b92f-e7c5816ea659',  -- Sales
  'aca55e64-c41b-4dd4-b07c-edf4ac33b66d'   -- People
);

-- Step 21: Delete root organization
DELETE FROM public.organizations 
WHERE id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- Step 22: Delete tenant
DELETE FROM public.tenants 
WHERE id = '0d3834bb-dab6-481d-8cba-90ec6b5bf8bf';

-- NOTE: The auth.users record (4c7a9aa0-cf11-4bfc-b79e-f2871e57c659) must be deleted separately
-- using the Supabase Admin API or the delete-user edge function, as it cannot be deleted via SQL migration.