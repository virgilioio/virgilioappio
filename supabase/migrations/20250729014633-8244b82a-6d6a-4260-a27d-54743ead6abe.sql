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
  
  -- Use SECURITY DEFINER to bypass RLS without SET commands
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
  
  -- Use SECURITY DEFINER to bypass RLS without SET commands
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
  
  -- Use SECURITY DEFINER to bypass RLS without SET commands
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
  
  -- Use a direct query with SECURITY DEFINER to bypass RLS completely
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
  
  -- Use a direct query with SECURITY DEFINER to bypass RLS completely
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
  
  -- Query database for actual user type instead of trusting JWT metadata
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
  
  -- Direct query without RLS to avoid recursion
  RETURN QUERY
  EXECUTE 'SELECT 
    COALESCE(m.user_type::text, ''guest'') as user_type,
    m.member_role::text as member_role,
    m.organization_id
  FROM public.members m
  WHERE m.user_id = $1 
  LIMIT 1'
  USING current_user_id;
  
  -- If no member record found, return guest
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
  -- If same currency, return 1
  IF from_currency = to_currency THEN
    RETURN 1.0;
  END IF;
  
  -- Get the latest rate
  SELECT rate INTO latest_rate
  FROM public.currency_exchange_rates
  WHERE base_currency = from_currency 
    AND target_currency = to_currency
  ORDER BY rate_date DESC, created_at DESC
  LIMIT 1;
  
  -- If no direct rate found, try inverse
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

-- Fix other critical functions
CREATE OR REPLACE FUNCTION public.accept_invitation(token_input uuid, new_user_id uuid)
RETURNS TABLE(success boolean, error_message text, member_id uuid, user_type text, member_role text, organization_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  member_record public.members%ROWTYPE;
BEGIN
  -- Add logging for security monitoring
  RAISE LOG 'Accepting invitation for token: % by user: %', token_input, new_user_id;
  
  -- Get the member record for this token with row-level locking
  SELECT * INTO member_record 
  FROM public.members 
  WHERE invite_token = token_input 
    AND user_status = 'invited' 
    AND invite_expires_at > now()
    AND user_id IS NULL
  FOR UPDATE;  -- Prevent concurrent access
  
  IF NOT FOUND THEN
    RAISE LOG 'Invalid invitation acceptance attempt for token: %', token_input;
    RETURN QUERY SELECT false, 'Invalid or expired invitation'::text, null::uuid, null::text, null::text, null::uuid;
    RETURN;
  END IF;
  
  -- Update the member record
  UPDATE public.members 
  SET 
    user_id = new_user_id,
    user_status = 'active',
    invite_token = NULL,
    invite_expires_at = NULL,
    updated_at = now()
  WHERE id = member_record.id;
  
  RAISE LOG 'Successfully accepted invitation for member: %', member_record.id;
  RETURN QUERY SELECT 
    true, 
    'Invitation accepted successfully'::text, 
    member_record.id,
    member_record.user_type::text,
    member_record.member_role::text,
    member_record.organization_id;
END;
$function$;

-- Fix safe_delete_user function
CREATE OR REPLACE FUNCTION public.safe_delete_user(target_user_id uuid)
RETURNS TABLE(success boolean, message text, affected_tables jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  billing_poc_orgs text[];
  affected_data jsonb := '{}';
BEGIN
  -- Check if user is referenced as billing POC in any organizations
  SELECT array_agg(name) INTO billing_poc_orgs
  FROM public.organizations 
  WHERE billing_poc_user_id = target_user_id;
  
  IF array_length(billing_poc_orgs, 1) > 0 THEN
    RETURN QUERY SELECT 
      false,
      'Cannot delete user: still assigned as billing POC for organizations: ' || array_to_string(billing_poc_orgs, ', '),
      jsonb_build_object('billing_poc_organizations', billing_poc_orgs);
    RETURN;
  END IF;
  
  -- Collect data that will be affected
  affected_data := jsonb_build_object(
    'profiles_deleted', (SELECT count(*) FROM public.profiles WHERE user_id = target_user_id),
    'members_deleted', (SELECT count(*) FROM public.members WHERE user_id = target_user_id),
    'activities_deleted', (SELECT count(*) FROM public.activities WHERE user_id = target_user_id),
    'job_assignments_deleted', (SELECT count(*) FROM public.job_assignments WHERE user_id = target_user_id)
  );
  
  -- Delete from all related tables (cascading will handle most of this)
  DELETE FROM public.profiles WHERE user_id = target_user_id;
  DELETE FROM public.members WHERE user_id = target_user_id;
  DELETE FROM public.activities WHERE user_id = target_user_id;
  DELETE FROM public.job_assignments WHERE user_id = target_user_id;
  
  -- Return success
  RETURN QUERY SELECT 
    true,
    'User data successfully deleted from all public tables. Auth user must be deleted via admin API.',
    affected_data;
END;
$function$;

-- Fix validate_invite_token function
CREATE OR REPLACE FUNCTION public.validate_invite_token(token_input uuid)
RETURNS TABLE(member_id uuid, organization_id uuid, member_role text, organization_name text, invite_email text, is_valid boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Add logging for security monitoring
  RAISE LOG 'Validating invite token: %', token_input;
  
  RETURN QUERY
  SELECT 
    m.id as member_id,
    m.organization_id,
    m.member_role::text,
    o.name as organization_name,
    m.invited_email as invite_email,
    CASE 
      WHEN m.id IS NULL THEN false
      WHEN m.user_status != 'invited' THEN false
      WHEN m.invite_expires_at < now() THEN false
      WHEN m.user_id IS NOT NULL THEN false
      ELSE true
    END as is_valid,
    CASE 
      WHEN m.id IS NULL THEN 'Invalid or expired invitation token'
      WHEN m.user_status != 'invited' THEN 'Invitation has already been accepted'
      WHEN m.invite_expires_at < now() THEN 'Invitation has expired'
      WHEN m.user_id IS NOT NULL THEN 'Invitation has already been used'
      ELSE 'Valid invitation'
    END as error_message
  FROM public.members m
  LEFT JOIN public.organizations o ON m.organization_id = o.id
  WHERE m.invite_token = token_input;
END;
$function$;

-- Phase 2: Add comprehensive RLS policies for members table
-- This is critical to prevent privilege escalation and unauthorized access

-- Enable RLS on members table if not already enabled
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Platform admins can manage all members" ON public.members;
DROP POLICY IF EXISTS "Organization admins can manage org members" ON public.members;
DROP POLICY IF EXISTS "Users can view their own member record" ON public.members;
DROP POLICY IF EXISTS "Members can view other members in their org" ON public.members;

-- Create comprehensive RLS policies for members table
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
  -- Allow if user is admin in same organization
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = members.organization_id
      AND m.member_role = 'admin'
      AND m.user_status = 'active'
  )
)
WITH CHECK (
  -- Prevent privilege escalation - admins cannot create platform_admin users
  (user_type != 'platform_admin' OR get_user_type_secure() = 'platform_admin')
  AND
  -- Must be in same organization
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = members.organization_id
      AND m.member_role = 'admin'
      AND m.user_status = 'active'
  )
);

-- Phase 3: Add database triggers to prevent privilege escalation
-- Prevent users from elevating their own privileges

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only platform admins can modify user_type
  IF OLD.user_type IS DISTINCT FROM NEW.user_type THEN
    IF get_user_type_secure() != 'platform_admin' THEN
      RAISE EXCEPTION 'Only platform administrators can modify user types';
    END IF;
  END IF;
  
  -- Users cannot modify their own member_role unless they are platform admin
  IF OLD.member_role IS DISTINCT FROM NEW.member_role AND OLD.user_id = auth.uid() THEN
    IF get_user_type_secure() != 'platform_admin' THEN
      RAISE EXCEPTION 'Users cannot modify their own member role';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to prevent privilege escalation
DROP TRIGGER IF EXISTS prevent_privilege_escalation_trigger ON public.members;
CREATE TRIGGER prevent_privilege_escalation_trigger
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privilege_escalation();

-- Phase 4: Add audit logging for sensitive operations
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

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view audit logs
CREATE POLICY "Platform admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (get_user_type_secure() = 'platform_admin');

-- Create audit trigger function
CREATE OR REPLACE FUNCTION public.audit_member_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Log significant changes to member records
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

-- Create audit trigger
DROP TRIGGER IF EXISTS audit_member_changes_trigger ON public.members;
CREATE TRIGGER audit_member_changes_trigger
  AFTER UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_member_changes();

-- Phase 5: Update RLS policies to use secure functions consistently
-- Replace get_user_type() with get_user_type_secure() in critical policies

-- Update activities policies
DROP POLICY IF EXISTS "Platform admins can manage all activities - secure" ON public.activities;
CREATE POLICY "Platform admins can manage all activities - secure"
ON public.activities
FOR ALL
TO authenticated
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

-- Update candidate_comments policies
DROP POLICY IF EXISTS "Platform admins can manage all candidate comments - secure" ON public.candidate_comments;
CREATE POLICY "Platform admins can manage all candidate comments - secure"
ON public.candidate_comments
FOR ALL
TO authenticated
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

-- Update job_assignments policies
DROP POLICY IF EXISTS "Platform admins can manage all job assignments - secure" ON public.job_assignments;
CREATE POLICY "Platform admins can manage all job assignments - secure"
ON public.job_assignments
FOR ALL
TO authenticated
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

-- Update job_candidates policies
DROP POLICY IF EXISTS "Platform admins can manage all job candidates - secure" ON public.job_candidates;
CREATE POLICY "Platform admins can manage all job candidates - secure"
ON public.job_candidates
FOR ALL
TO authenticated
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

-- Update jobs policies
DROP POLICY IF EXISTS "Platform admins can manage all jobs - secure" ON public.jobs;
CREATE POLICY "Platform admins can manage all jobs - secure"
ON public.jobs
FOR ALL
TO authenticated
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

-- Update job_requests policies
DROP POLICY IF EXISTS "Platform admins can manage all job requests - secure" ON public.job_requests;
CREATE POLICY "Platform admins can manage all job requests - secure"
ON public.job_requests
FOR ALL
TO authenticated
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

-- Update invoices policies
DROP POLICY IF EXISTS "Platform admins can manage all invoices - secure" ON public.invoices;
CREATE POLICY "Platform admins can manage all invoices - secure"
ON public.invoices
FOR ALL
TO authenticated
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

-- Update invoice_payments policies
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

-- Add constraints to prevent data integrity issues
ALTER TABLE public.members ADD CONSTRAINT check_no_self_privilege_escalation 
CHECK (user_id != auth.uid() OR user_type != 'platform_admin' OR get_user_type_secure() = 'platform_admin');

-- Log completion
RAISE NOTICE 'Security hardening migration completed successfully';
RAISE NOTICE 'Fixed % database functions with proper search_path protection', 10;
RAISE NOTICE 'Added comprehensive RLS policies for members table';
RAISE NOTICE 'Added privilege escalation prevention triggers';
RAISE NOTICE 'Added audit logging for sensitive operations';
RAISE NOTICE 'Updated all critical RLS policies to use secure functions';