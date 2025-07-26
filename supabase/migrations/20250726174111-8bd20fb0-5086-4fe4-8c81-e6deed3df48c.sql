-- Apply search_path protection to remaining database functions for SQL injection prevention
-- This is critical security fix to prevent search_path attacks

-- Update get_user_type function
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
  -- This works because SECURITY DEFINER runs with elevated privileges
  SELECT COALESCE(user_type::text, 'guest') INTO user_type_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$function$;

-- Update get_user_organization_id function
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

-- Update get_member_role function
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

-- Update get_user_type_secure function
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

-- Update accept_invitation function
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

-- Update validate_invite_token function
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

-- Update safe_delete_user function
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

-- Update additional critical functions with search_path protection
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