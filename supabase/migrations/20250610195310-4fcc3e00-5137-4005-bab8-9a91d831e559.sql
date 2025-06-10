
-- Corrected Phase 1: Database Schema Changes

-- Create user_type enum (if not exists)
DO $$ BEGIN
    CREATE TYPE public.user_type_enum AS ENUM ('platform_admin', 'workspace_owner', 'member', 'guest');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add user_type column to members table (preserving existing member_role)
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS user_type public.user_type_enum DEFAULT 'member';

-- Create migration function to copy user_type from auth metadata to members table
CREATE OR REPLACE FUNCTION public.migrate_user_types()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  user_type_value TEXT;
  platform_org_id UUID;
BEGIN
  -- Get the platform organization ID for platform admins
  SELECT id INTO platform_org_id 
  FROM public.organizations 
  WHERE organization_type = 'platform' 
  LIMIT 1;
  
  -- If no platform org exists, create one
  IF platform_org_id IS NULL THEN
    INSERT INTO public.organizations (name, organization_type, country)
    VALUES ('Virgilio Platform', 'platform', 'US')
    RETURNING id INTO platform_org_id;
  END IF;
  
  -- Iterate through all users in auth.users
  FOR user_record IN 
    SELECT id, raw_user_meta_data
    FROM auth.users
  LOOP
    -- Extract user_type from metadata
    user_type_value := COALESCE(user_record.raw_user_meta_data->>'user_type', 'guest');
    
    -- Check if user already has a member record
    IF EXISTS (SELECT 1 FROM public.members WHERE user_id = user_record.id) THEN
      -- Update existing member record with user_type (preserving member_role)
      UPDATE public.members 
      SET user_type = user_type_value::public.user_type_enum
      WHERE user_id = user_record.id;
    ELSE
      -- Create new member record for users without one
      IF user_type_value = 'platform_admin' THEN
        -- Platform admins get assigned to platform organization with admin role
        INSERT INTO public.members (user_id, organization_id, member_role, user_status, user_type)
        VALUES (user_record.id, platform_org_id, 'admin', 'active', 'platform_admin'::public.user_type_enum);
      -- For other user types, we'll let the application handle assignment later
      -- since they need proper organization context
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Run the migration
SELECT public.migrate_user_types();

-- Update get_user_type function to read from members table
CREATE OR REPLACE FUNCTION public.get_user_type()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(user_type::text, 'guest')
  FROM public.members 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$;

-- Create new function to get comprehensive user member data
CREATE OR REPLACE FUNCTION public.get_user_member_data()
RETURNS TABLE(user_type text, member_role text, organization_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT 
    COALESCE(m.user_type::text, 'guest') as user_type,
    COALESCE(m.member_role::text, null) as member_role,
    m.organization_id
  FROM public.members m
  WHERE m.user_id = auth.uid() 
  LIMIT 1;
$$;

-- Clean up the migration function
DROP FUNCTION IF EXISTS public.migrate_user_types();
