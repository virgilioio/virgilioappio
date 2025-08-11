
-- 1) Per-user subscribers table (standard pattern)
-- Note: This is kept minimal and primarily used by login hooks if needed. 
-- Main source of truth will be tenant_subscriptions for tenant-wide billing.
CREATE TABLE IF NOT EXISTS public.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  subscribed BOOLEAN NOT NULL DEFAULT false,
  subscription_tier TEXT,
  subscription_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriber record
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscribers' AND policyname = 'select_own_subscription'
  ) THEN
    CREATE POLICY "select_own_subscription" ON public.subscribers
    FOR SELECT
    USING (user_id = auth.uid() OR email = auth.email());
  END IF;
END$$;

-- Users can update their own subscriber record (optional, edge functions will normally do writes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscribers' AND policyname = 'update_own_subscription'
  ) THEN
    CREATE POLICY "update_own_subscription" ON public.subscribers
    FOR UPDATE
    USING (user_id = auth.uid() OR email = auth.email());
  END IF;
END$$;


-- 2) Tenant-wide subscription table (source of truth)
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  stripe_customer_id TEXT,
  subscribed BOOLEAN NOT NULL DEFAULT false,
  subscription_tier TEXT,
  billing_interval TEXT, -- 'month' | 'year'
  seat_quantity INTEGER NOT NULL DEFAULT 0,
  trial_end TIMESTAMPTZ,
  subscription_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_subscriptions_tenant_unique UNIQUE (tenant_id)
);

-- RLS
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all tenant subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_subscriptions' AND policyname = 'platform_admin_manage_all_tenant_subs'
  ) THEN
    CREATE POLICY "platform_admin_manage_all_tenant_subs"
    ON public.tenant_subscriptions
    AS PERMISSIVE
    FOR ALL
    USING (public.get_user_type_secure() = 'platform_admin')
    WITH CHECK (public.get_user_type_secure() = 'platform_admin');
  END IF;
END$$;

-- Tenant admins can view their own tenant subscription row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_subscriptions' AND policyname = 'tenant_admin_select_own'
  ) THEN
    CREATE POLICY "tenant_admin_select_own"
    ON public.tenant_subscriptions
    AS PERMISSIVE
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.organizations o
        JOIN public.members m ON m.organization_id = o.id
        WHERE o.tenant_id = tenant_subscriptions.tenant_id
          AND m.user_id = auth.uid()
          AND m.user_status = 'active'
          AND m.member_role = 'admin'
      )
      OR public.get_user_type_secure() = 'platform_admin'
    );
  END IF;
END$$;


-- 3) Helper to get current user's tenant
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $func$
DECLARE
  result uuid;
BEGIN
  -- Prefer the tenant of the user's primary organization membership
  SELECT o.tenant_id
    INTO result
  FROM public.members m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.user_id = auth.uid() 
    AND m.user_status = 'active'
  ORDER BY m.created_at NULLS LAST, m.id
  LIMIT 1;

  RETURN result;
END;
$func$;


-- 4) Billable seat count function (distinct active users in admin/recruiter roles under the tenant)
CREATE OR REPLACE FUNCTION public.get_tenant_billable_seat_count(tenant_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $func$
DECLARE
  cnt integer;
BEGIN
  SELECT COUNT(DISTINCT m.user_id)
    INTO cnt
  FROM public.members m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE o.tenant_id = tenant_id_param
    AND m.user_status = 'active'
    AND m.member_role IN ('admin','recruiter')
    AND COALESCE(m.user_type::text, '') <> 'platform_admin';

  RETURN COALESCE(cnt, 0);
END;
$func$;


-- 5) Backfill a row per existing tenant (if not present)
INSERT INTO public.tenant_subscriptions (tenant_id, subscribed, seat_quantity)
SELECT DISTINCT o.tenant_id, false, 0
FROM public.organizations o
WHERE o.tenant_id IS NOT NULL
ON CONFLICT (tenant_id) DO NOTHING;
