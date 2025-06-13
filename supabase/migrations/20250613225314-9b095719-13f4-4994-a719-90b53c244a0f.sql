
-- First, let's check if profiles table has organization_id or if we need to join through members
-- Add organization_id to profiles if it doesn't exist (for easier RLS)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'organization_id') THEN
        ALTER TABLE public.profiles ADD COLUMN organization_id UUID;
        
        -- Update existing profiles with organization_id from members table
        UPDATE public.profiles 
        SET organization_id = m.organization_id
        FROM public.members m
        WHERE profiles.user_id = m.user_id;
    END IF;
END $$;

-- Drop existing restrictive RLS policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create new RLS policies for profiles table
CREATE POLICY "Platform Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (get_user_type() = 'platform_admin');

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow org members to read profiles within their organization
CREATE POLICY "Org members can read profiles in their org"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = get_user_organization_id()
  );

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create a security definer function to get member display info safely
CREATE OR REPLACE FUNCTION public.get_member_display_info(member_user_id UUID)
RETURNS TABLE(
  first_name TEXT,
  last_name TEXT,
  email TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Only allow if current user is platform admin or in same org
  IF get_user_type() = 'platform_admin' OR 
     EXISTS (
       SELECT 1 FROM public.members m1, public.members m2
       WHERE m1.user_id = auth.uid()
         AND m2.user_id = member_user_id
         AND m1.organization_id = m2.organization_id
     ) THEN
    
    RETURN QUERY
    SELECT p.first_name, p.last_name, au.email::text
    FROM public.profiles p
    LEFT JOIN auth.users au ON p.user_id = au.id
    WHERE p.user_id = member_user_id;
  END IF;
  
  RETURN;
END;
$$;
