
-- Fix missing foreign key relationships between organizations and profiles tables
-- Add foreign key constraints to enable proper joins

-- First, let's add the missing foreign key constraint for organizations.owner_id -> profiles.user_id
ALTER TABLE public.organizations 
ADD CONSTRAINT fk_organizations_owner_profiles 
FOREIGN KEY (owner_id) REFERENCES public.profiles(user_id) 
ON DELETE SET NULL;

-- Add foreign key constraint for organizations.created_by -> profiles.user_id  
ALTER TABLE public.organizations 
ADD CONSTRAINT fk_organizations_created_by_profiles 
FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) 
ON DELETE SET NULL;

-- Update RLS policies on profiles table to allow workspace owners to read profile data
-- Drop the restrictive policy that's preventing access
DROP POLICY IF EXISTS "Org members can read profiles in their org" ON public.profiles;

-- Create a more permissive policy for workspace owners and platform admins
CREATE POLICY "Workspace owners and platform admins can read profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    get_user_type() = 'platform_admin' OR
    get_user_type() = 'workspace_owner' OR
    auth.uid() = user_id
  );

-- Also allow customer success to read profiles  
CREATE POLICY "Customer success can read profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (get_member_role() = 'customer_success');
