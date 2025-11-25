-- Comprehensive cleanup for anirbanfiem@gmail.com (user_id: 2e6a6b01-f0cf-4580-9caa-2d116e0c8f21)
-- Keep Wiki tenant: 5c1399d1-f8c0-4980-945a-670d2d995f41
-- Delete 5 orphaned organizations

-- Step 1: Delete subscription for test workspace
DELETE FROM public.tenant_subscriptions 
WHERE tenant_id = '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb';

-- Step 2: Delete member records for this user (will be recreated for Wiki)
DELETE FROM public.members 
WHERE user_id = '2e6a6b01-f0cf-4580-9caa-2d116e0c8f21';

-- Step 3: Delete all 5 orphaned organizations
DELETE FROM public.organizations 
WHERE id IN (
  '63152268-1c8f-47bd-8bed-11bb7abf7ad8',  -- WikiCom
  '57cd41f3-af0a-4843-a5e1-4cd66a22edad',  -- testWS
  'c844a73f-4a53-4cfc-a5df-94956749d00f',  -- gbwedbwcd
  '925f437c-6d49-47c7-93e9-5d359599d223',  -- gbwedbwcd
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb'   -- test workspace
);

-- Step 4: Activate Wiki tenant (5c1399d1-f8c0-4980-945a-670d2d995f41)

-- Set owner_id
UPDATE public.organizations
SET owner_id = '2e6a6b01-f0cf-4580-9caa-2d116e0c8f21',
    updated_at = now()
WHERE id = '5c1399d1-f8c0-4980-945a-670d2d995f41';

-- Create member record as workspace_owner
INSERT INTO public.members (
  user_id,
  organization_id,
  tenant_id,
  user_type,
  member_role,
  user_status
) VALUES (
  '2e6a6b01-f0cf-4580-9caa-2d116e0c8f21',
  '5c1399d1-f8c0-4980-945a-670d2d995f41',
  '5c1399d1-f8c0-4980-945a-670d2d995f41',
  'workspace_owner',
  'admin',
  'active'
);

-- Create 14-day trial subscription
INSERT INTO public.tenant_subscriptions (
  tenant_id,
  subscription_tier,
  billing_status,
  trial_started_at,
  trial_ends_at,
  trial_source
) VALUES (
  '5c1399d1-f8c0-4980-945a-670d2d995f41',
  'launch',
  'trialing',
  now(),
  now() + INTERVAL '14 days',
  'self_signup'
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Step 5: Update user profile to Wiki tenant
UPDATE public.profiles
SET organization_id = '5c1399d1-f8c0-4980-945a-670d2d995f41',
    updated_at = now()
WHERE user_id = '2e6a6b01-f0cf-4580-9caa-2d116e0c8f21';