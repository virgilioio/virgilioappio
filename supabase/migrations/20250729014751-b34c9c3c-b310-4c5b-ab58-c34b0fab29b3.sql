-- COMPREHENSIVE SECURITY FIXES
-- This migration addresses all critical security vulnerabilities identified in the security review

-- Phase 1: Fix Security Definer Functions - Add proper search_path protection
-- All SECURITY DEFINER functions must have SET search_path = '' to prevent injection attacks

-- Fix get_user_type function
CREATE OR REPLACE FUNCTION public.get_user_type()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_user_id uuid;
  user_type_result text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 'guest';
  END IF;
  
  -- First check auth metadata for platform admin
  IF (auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin' THEN
    RETURN 'platform_admin';
  END IF;
  
  SELECT COALESCE(user_type::text, 'guest') INTO user_type_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$function$;

-- Fix get_user_organization_id function
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_user_id uuid;
  org_id_result uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT organization_id INTO org_id_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  RETURN org_id_result;
END;
$function$;

-- Fix get_member_role function
CREATE OR REPLACE FUNCTION public.get_member_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_user_id uuid;
  member_role_result text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 'guest';
  END IF;
  
  SELECT COALESCE(member_role::text, 'guest') INTO member_role_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  RETURN COALESCE(member_role_result, 'guest');
END;
$function$;

-- Fix get_user_type_safe function
CREATE OR REPLACE FUNCTION public.get_user_type_safe()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_user_id uuid;
  user_type_result text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 'guest';
  END IF;
  
  -- First check auth metadata for platform admin
  IF (auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin' THEN
    RETURN 'platform_admin';
  END IF;
  
  SELECT COALESCE(user_type::text, 'guest') INTO user_type_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$function$;

-- Fix get_member_role_safe function
CREATE OR REPLACE FUNCTION public.get_member_role_safe()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_user_id uuid;
  member_role_result text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 'guest';
  END IF;
  
  SELECT COALESCE(member_role::text, 'guest') INTO member_role_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  RETURN COALESCE(member_role_result, 'guest');
END;
$function$;

-- Fix get_user_type_secure function
CREATE OR REPLACE FUNCTION public.get_user_type_secure()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_user_id uuid;
  user_type_result text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 'guest';
  END IF;
  
  SELECT COALESCE(user_type::text, 'guest') INTO user_type_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$function$;

-- Fix get_user_member_data function
CREATE OR REPLACE FUNCTION public.get_user_member_data()
RETURNS TABLE(user_type text, member_role text, organization_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN QUERY SELECT 'guest'::text, null::text, null::uuid;
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    COALESCE(m.user_type::text, 'guest') as user_type,
    m.member_role::text as member_role,
    m.organization_id
  FROM public.members m
  WHERE m.user_id = current_user_id 
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'guest'::text, null::text, null::uuid;
  END IF;
END;
$function$;

-- Fix get_organization_default_currency function
CREATE OR REPLACE FUNCTION public.get_organization_default_currency(org_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  default_curr text;
BEGIN
  SELECT default_currency INTO default_curr
  FROM public.organizations
  WHERE id = org_id;
  
  RETURN COALESCE(default_curr, 'USD');
END;
$function$;

-- Fix get_latest_exchange_rate function
CREATE OR REPLACE FUNCTION public.get_latest_exchange_rate(from_currency text, to_currency text)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  latest_rate NUMERIC;
BEGIN
  IF from_currency = to_currency THEN
    RETURN 1.0;
  END IF;
  
  SELECT rate INTO latest_rate
  FROM public.currency_exchange_rates
  WHERE base_currency = from_currency 
    AND target_currency = to_currency
  ORDER BY rate_date DESC, created_at DESC
  LIMIT 1;
  
  IF latest_rate IS NULL THEN
    SELECT (1.0 / rate) INTO latest_rate
    FROM public.currency_exchange_rates
    WHERE base_currency = to_currency 
      AND target_currency = from_currency
    ORDER BY rate_date DESC, created_at DESC
    LIMIT 1;
  END IF;
  
  RETURN COALESCE(latest_rate, 1.0);
END;
$function$;

-- Phase 2: Add comprehensive RLS policies for members table
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can manage all members" ON public.members;
DROP POLICY IF EXISTS "Organization admins can manage org members" ON public.members;
DROP POLICY IF EXISTS "Users can view their own member record" ON public.members;
DROP POLICY IF EXISTS "Members can view other members in their org" ON public.members;

CREATE POLICY "Platform admins can manage all members - secure"
ON public.members
FOR ALL
TO authenticated
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Users can view their own member record"
ON public.members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Organization admins can view members in their org"
ON public.members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = members.organization_id
      AND m.member_role = 'admin'
      AND m.user_status = 'active'
  )
);

CREATE POLICY "Organization admins can manage members in their org"
ON public.members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = members.organization_id
      AND m.member_role = 'admin'
      AND m.user_status = 'active'
  )
)
WITH CHECK (
  (user_type != 'platform_admin' OR get_user_type_secure() = 'platform_admin')
  AND
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = members.organization_id
      AND m.member_role = 'admin'
      AND m.user_status = 'active'
  )
);

-- Phase 3: Add privilege escalation prevention
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF OLD.user_type IS DISTINCT FROM NEW.user_type THEN
    IF get_user_type_secure() != 'platform_admin' THEN
      RAISE EXCEPTION 'Only platform administrators can modify user types';
    END IF;
  END IF;
  
  IF OLD.member_role IS DISTINCT FROM NEW.member_role AND OLD.user_id = auth.uid() THEN
    IF get_user_type_secure() != 'platform_admin' THEN
      RAISE EXCEPTION 'Users cannot modify their own member role';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_privilege_escalation_trigger ON public.members;
CREATE TRIGGER prevent_privilege_escalation_trigger
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privilege_escalation();

-- Phase 4: Add audit logging
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (get_user_type_secure() = 'platform_admin');

CREATE OR REPLACE FUNCTION public.audit_member_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.user_type IS DISTINCT FROM NEW.user_type 
       OR OLD.member_role IS DISTINCT FROM NEW.member_role 
       OR OLD.user_status IS DISTINCT FROM NEW.user_status THEN
      
      INSERT INTO public.audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values
      ) VALUES (
        auth.uid(),
        'UPDATE',
        'members',
        NEW.id,
        jsonb_build_object(
          'user_type', OLD.user_type,
          'member_role', OLD.member_role,
          'user_status', OLD.user_status
        ),
        jsonb_build_object(
          'user_type', NEW.user_type,
          'member_role', NEW.member_role,
          'user_status', NEW.user_status
        )
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS audit_member_changes_trigger ON public.members;
CREATE TRIGGER audit_member_changes_trigger
  AFTER UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_member_changes();

-- Phase 5: Update critical RLS policies to use secure functions
DROP POLICY IF EXISTS "Platform admins can manage all activities - secure" ON public.activities;
CREATE POLICY "Platform admins can manage all activities - secure"
ON public.activities
FOR ALL
TO authenticated
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

DROP POLICY IF EXISTS "Platform admins can manage all invoices - secure" ON public.invoices;
CREATE POLICY "Platform admins can manage all invoices - secure"
ON public.invoices
FOR ALL
TO authenticated
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

DROP POLICY IF EXISTS "Platform admins can view all payment records - secure" ON public.invoice_payments;
DROP POLICY IF EXISTS "Platform admins can insert payment records - secure" ON public.invoice_payments;
DROP POLICY IF EXISTS "Platform admins can update payment records - secure" ON public.invoice_payments;
DROP POLICY IF EXISTS "Platform admins can delete payment records - secure" ON public.invoice_payments;

CREATE POLICY "Platform admins can view all payment records - secure"
ON public.invoice_payments
FOR SELECT
TO authenticated
USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can insert payment records - secure"
ON public.invoice_payments
FOR INSERT
TO authenticated
WITH CHECK (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can update payment records - secure"
ON public.invoice_payments
FOR UPDATE
TO authenticated
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can delete payment records - secure"
ON public.invoice_payments
FOR DELETE
TO authenticated
USING (get_user_type_secure() = 'platform_admin');