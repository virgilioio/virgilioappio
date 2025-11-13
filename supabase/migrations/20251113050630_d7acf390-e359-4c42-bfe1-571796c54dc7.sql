-- Phase 2: Manually provision "Motive" tenant for allan.bravo@gomotive.com
-- Using dual-insert strategy: same UUID for tenant and root organization
-- Temporarily disable triggers to allow direct provisioning

-- Generate a new UUID for both tenant and root organization
DO $$
DECLARE
  v_tenant_id UUID := gen_random_uuid();
  v_user_id UUID := 'b884b74f-decf-4955-ac6a-d19357910a7d';
  v_workspace_name TEXT := 'Motive';
  v_trial_days INTEGER := 14;
BEGIN
  -- Temporarily disable session-level RLS and triggers
  SET session_replication_role = 'replica';

  -- 1. Insert tenant record
  INSERT INTO public.tenants (id, name, tenant_type, created_at, updated_at, status)
  VALUES (
    v_tenant_id,
    v_workspace_name,
    'saas',  -- SaaS customer tenant type
    now(),
    now(),
    'active'
  );

  -- 2. Insert root organization with SAME UUID
  INSERT INTO public.organizations (
    id,
    tenant_id,
    name,
    org_kind,
    parent_organization_id,
    created_at,
    updated_at,
    status
  )
  VALUES (
    v_tenant_id,  -- Same UUID as tenant
    v_tenant_id,
    v_workspace_name,
    'root',       -- Root organization type
    NULL,         -- No parent
    now(),
    now(),
    'active'
  );

  -- 3. Insert member record for allan.bravo@gomotive.com
  INSERT INTO public.members (
    id,
    user_id,
    tenant_id,
    organization_id,
    user_type,
    user_status,
    member_role,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    v_tenant_id,
    v_tenant_id,  -- Same as tenant_id
    'workspace_owner',  -- user_type
    'active',
    'admin',  -- member_role (workspace_owner gets admin role)
    now(),
    now()
  );

  -- 4. Insert trial subscription
  INSERT INTO public.tenant_subscriptions (
    id,
    tenant_id,
    subscription_tier,
    billing_interval,
    billing_status,
    trial_started_at,
    trial_ends_at,
    seat_quantity,
    max_users,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_tenant_id,
    'launch',
    'monthly',
    'trialing',
    now(),
    now() + (v_trial_days || ' days')::interval,
    1,  -- Current seat count
    5,  -- Launch tier max users
    now(),
    now()
  );

  -- Re-enable triggers
  SET session_replication_role = 'origin';

  RAISE NOTICE 'Successfully provisioned Motive tenant with ID: %', v_tenant_id;
END $$;