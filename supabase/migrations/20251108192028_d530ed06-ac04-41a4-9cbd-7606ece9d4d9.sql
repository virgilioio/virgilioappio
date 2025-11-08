-- Security Fix: Restrict profiles table access to authenticated users only
-- This prevents anonymous users from accessing employee PII (email, phone, LinkedIn, names)

-- Step 1: Revoke table-level grants from anon role (defense-in-depth)
REVOKE ALL ON public.profiles FROM anon;

-- Step 2: Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Organization members can view profiles in their org" ON public.profiles;
DROP POLICY IF EXISTS "Workspace owners and platform admins can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Platform admins can manage all profiles - secure" ON public.profiles;

-- Step 3: Recreate policies with TO authenticated (blocks anonymous access)
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own profile"
  ON public.profiles FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Organization members can view profiles in their org"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = profiles.organization_id 
      AND m.user_status = 'active'
    )
  );

CREATE POLICY "Workspace owners and platform admins can read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    get_user_type_secure() = 'platform_admin' OR
    get_user_type_secure() = 'workspace_owner' OR
    auth.uid() = user_id
  );

CREATE POLICY "Platform admins can manage all profiles - secure"
  ON public.profiles FOR ALL
  TO authenticated
  USING (get_user_type_secure() = 'platform_admin');