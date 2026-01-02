-- HARD DELETE: Phoenix Growth Agency
-- Tenant ID: efdb4b17-13e4-447f-89fe-4326041258b1
-- User ID: 5a77bfd0-9c0e-478d-a13e-f2f33514d273

-- Step 1: Delete sourcing credits usage (FK dependency)
DELETE FROM public.sourcing_credits_usage 
WHERE tenant_id = 'efdb4b17-13e4-447f-89fe-4326041258b1';

-- Step 2: Delete AI conversations and messages (messages cascade)
DELETE FROM public.ai_conversations 
WHERE tenant_id = 'efdb4b17-13e4-447f-89fe-4326041258b1';

-- Step 3: Delete onboarding progress
DELETE FROM public.onboarding_progress 
WHERE tenant_id = 'efdb4b17-13e4-447f-89fe-4326041258b1';

-- Step 4: Delete activities
DELETE FROM public.activities 
WHERE tenant_id = 'efdb4b17-13e4-447f-89fe-4326041258b1';

-- Step 5: Delete members
DELETE FROM public.members 
WHERE tenant_id = 'efdb4b17-13e4-447f-89fe-4326041258b1';

-- Step 6: Delete profile
DELETE FROM public.profiles 
WHERE user_id = '5a77bfd0-9c0e-478d-a13e-f2f33514d273';

-- Step 7: Delete tenant subscription
DELETE FROM public.tenant_subscriptions 
WHERE tenant_id = 'efdb4b17-13e4-447f-89fe-4326041258b1';

-- Step 8: Delete organization (root org has same ID as tenant)
DELETE FROM public.organizations 
WHERE id = 'efdb4b17-13e4-447f-89fe-4326041258b1';

-- Step 9: Delete tenant
DELETE FROM public.tenants 
WHERE id = 'efdb4b17-13e4-447f-89fe-4326041258b1';