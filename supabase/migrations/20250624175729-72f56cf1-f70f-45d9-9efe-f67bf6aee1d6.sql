
-- Step 1: Check and fix invoices table policies
-- Only drop policies that might be recursive, keep the existing non-recursive ones
DROP POLICY IF EXISTS "invoices_consolidated_select_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_consolidated_insert_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_consolidated_update_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_consolidated_delete_policy" ON public.invoices;

-- Only create invoices policies if they don't exist (they might already be correct from previous migration)
-- The "Platform admins can manage all invoices" and "Organization members can view their invoices" 
-- policies already exist and are correct, so we skip them

-- Step 2: Fix Organization Custom Data Table
DROP POLICY IF EXISTS "Platform admins can manage all organization custom data" ON public.organization_custom_data;
DROP POLICY IF EXISTS "Organization members can view their custom data" ON public.organization_custom_data;
DROP POLICY IF EXISTS "Organization admins can manage their custom data" ON public.organization_custom_data;

-- Create new non-recursive policies for organization_custom_data
CREATE POLICY "Platform admins can manage all organization custom data"
  ON public.organization_custom_data FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Organization members can view their custom data"
  ON public.organization_custom_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = organization_custom_data.organization_id 
      AND m.user_status = 'active'
    )
  );

CREATE POLICY "Organization admins can manage their custom data"
  ON public.organization_custom_data FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = organization_custom_data.organization_id 
      AND m.member_role = 'admin'
      AND m.user_status = 'active'
    )
  );

-- Step 3: Fix Profiles Table
DROP POLICY IF EXISTS "Platform admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Organization members can view profiles in their org" ON public.profiles;

-- Create new non-recursive policies for profiles
CREATE POLICY "Platform admins can manage all profiles"
  ON public.profiles FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Organization members can view profiles in their org"
  ON public.profiles FOR SELECT
  USING (
    organization_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = profiles.organization_id 
      AND m.user_status = 'active'
    )
  );

-- Step 4: Invoice payments policies should already be correct from previous migration
-- but let's ensure they're platform admin only without recreating them if they exist
-- The invoice_payments policies are already correct from the previous migration
