-- Comprehensive cleanup: Delete all data for allan.bravo@gomotive.com and Motive tenant (CORRECT IDs)
-- User ID: 4d0b4266-b705-4538-b061-75eee34b349c
-- Tenant ID: 005e3a2a-eed0-4b6e-b079-71f8d8862705
-- Child Org IDs: 37a3f4a5-855d-4825-a925-a25dd77b5c0d (Sales), a0cc586e-33fd-4e93-9406-291b66f42739 (People)

-- Step 1: Delete careers page settings
DELETE FROM public.careers_page_settings 
WHERE tenant_id = '005e3a2a-eed0-4b6e-b079-71f8d8862705';

-- Step 2: Delete booking configurations
DELETE FROM public.booking_configurations 
WHERE user_id = '4d0b4266-b705-4538-b061-75eee34b349c';

-- Step 3: Delete coresignal usage
DELETE FROM public.coresignal_usage 
WHERE tenant_id = '005e3a2a-eed0-4b6e-b079-71f8d8862705';

-- Step 4: Delete calendar identities
DELETE FROM public.calendar_identities 
WHERE user_id = '4d0b4266-b705-4538-b061-75eee34b349c';

-- Step 5: Delete user mail identities
DELETE FROM public.user_mail_identities 
WHERE user_id = '4d0b4266-b705-4538-b061-75eee34b349c';

-- Step 6: Delete onboarding progress
DELETE FROM public.onboarding_progress 
WHERE user_id = '4d0b4266-b705-4538-b061-75eee34b349c';

-- Step 7: Delete activities (if any)
DELETE FROM public.activities 
WHERE tenant_id = '005e3a2a-eed0-4b6e-b079-71f8d8862705';

-- Step 8: Delete email rate limits (if any)
DELETE FROM public.email_rate_limits 
WHERE tenant_id = '005e3a2a-eed0-4b6e-b079-71f8d8862705';

-- Step 9: Delete email suppression list (if any)
DELETE FROM public.email_suppression_list 
WHERE tenant_id = '005e3a2a-eed0-4b6e-b079-71f8d8862705';

-- Step 10: Delete AI conversations (if any)
DELETE FROM public.ai_conversations 
WHERE tenant_id = '005e3a2a-eed0-4b6e-b079-71f8d8862705';

-- Step 11: Delete application fields (if any)
DELETE FROM public.application_fields 
WHERE tenant_id = '005e3a2a-eed0-4b6e-b079-71f8d8862705';

-- Step 12: Delete contract templates (if any)
DELETE FROM public.contract_templates 
WHERE tenant_id = '005e3a2a-eed0-4b6e-b079-71f8d8862705';

-- Step 13: Delete job board integrations (if any)
DELETE FROM public.job_board_integrations 
WHERE tenant_id = '005e3a2a-eed0-4b6e-b079-71f8d8862705';

-- Step 14: Delete members
DELETE FROM public.members 
WHERE user_id = '4d0b4266-b705-4538-b061-75eee34b349c';

-- Step 15: Delete profile
DELETE FROM public.profiles 
WHERE user_id = '4d0b4266-b705-4538-b061-75eee34b349c';

-- Step 16: Delete tenant subscription
DELETE FROM public.tenant_subscriptions 
WHERE tenant_id = '005e3a2a-eed0-4b6e-b079-71f8d8862705';

-- Step 17: Delete child organizations
DELETE FROM public.organizations 
WHERE id IN (
  '37a3f4a5-855d-4825-a925-a25dd77b5c0d',  -- Sales
  'a0cc586e-33fd-4e93-9406-291b66f42739'   -- People
);

-- Step 18: Delete tenant (which is also the root organization)
DELETE FROM public.tenants 
WHERE id = '005e3a2a-eed0-4b6e-b079-71f8d8862705';

-- NOTE: The auth.users record (4d0b4266-b705-4538-b061-75eee34b349c) and auth.identities
-- must be deleted manually using the Supabase Dashboard (Authentication → Users → Delete User)
-- or via the Admin API, as they cannot be deleted via SQL migration.