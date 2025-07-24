-- Check current RLS policies on countries table
-- Drop existing policies to recreate them with correct logic
DROP POLICY IF EXISTS "Platform admins can delete countries" ON public.countries;
DROP POLICY IF EXISTS "Platform admins can insert countries" ON public.countries;
DROP POLICY IF EXISTS "Platform admins can update countries" ON public.countries;

-- Create new policies that work with the secure functions
CREATE POLICY "Platform admins can manage countries" 
  ON public.countries 
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

-- Also allow all users to view active countries (this policy already exists)
-- But let's make sure it's correctly defined
DROP POLICY IF EXISTS "All users can view active countries" ON public.countries;
CREATE POLICY "All users can view active countries" 
  ON public.countries 
  FOR SELECT
  USING (is_active = true);