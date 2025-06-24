
-- CRITICAL SECURITY FIX: Replace unsafe user_metadata RLS policies with secure database-based role checking

-- Phase 1: Create secure helper function that uses database roles instead of JWT metadata
CREATE OR REPLACE FUNCTION public.get_user_type_secure()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
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
$$;

-- Phase 2: Drop all unsafe RLS policies that use user_metadata
-- Activities table policies
DROP POLICY IF EXISTS "Platform admins can manage all activities" ON public.activities;
DROP POLICY IF EXISTS "activities_platform_admin" ON public.activities;
DROP POLICY IF EXISTS "activities_platform_admin_access" ON public.activities;

-- Invoice payments table policies  
DROP POLICY IF EXISTS "Platform admins can view all payment records" ON public.invoice_payments;
DROP POLICY IF EXISTS "Platform admins can insert payment records" ON public.invoice_payments;
DROP POLICY IF EXISTS "Platform admins can update payment records" ON public.invoice_payments;
DROP POLICY IF EXISTS "Platform admins can delete payment records" ON public.invoice_payments;

-- Invoices table policies
DROP POLICY IF EXISTS "Platform admins can manage all invoices" ON public.invoices;

-- Job assignments table policies
DROP POLICY IF EXISTS "Platform admins can manage all job assignments" ON public.job_assignments;

-- Job candidates table policies
DROP POLICY IF EXISTS "Platform admins can manage all job candidates" ON public.job_candidates;

-- Job requests table policies
DROP POLICY IF EXISTS "Platform admins can manage all job requests" ON public.job_requests;

-- Jobs table policies
DROP POLICY IF EXISTS "Platform admins can manage all jobs" ON public.jobs;

-- Members table policies
DROP POLICY IF EXISTS "members_platform_admin" ON public.members;
DROP POLICY IF EXISTS "members_platform_admin_access" ON public.members;

-- Organization custom data table policies
DROP POLICY IF EXISTS "Platform admins can manage all organization custom data" ON public.organization_custom_data;

-- Organizations table policies
DROP POLICY IF EXISTS "Platform admins can manage all organizations" ON public.organizations;

-- Profiles table policies
DROP POLICY IF EXISTS "Platform admins can manage all profiles" ON public.profiles;

-- Candidate comments table policies
DROP POLICY IF EXISTS "Platform admins can manage all candidate comments" ON public.candidate_comments;

-- Storage policies for invoice files
DROP POLICY IF EXISTS "Platform admins can upload invoices" ON storage.objects;
DROP POLICY IF EXISTS "Platform admins can view all invoice files" ON storage.objects;

-- Phase 3: Create new secure RLS policies using database-based role checking

-- Activities table - secure policies
CREATE POLICY "Platform admins can manage all activities - secure"
  ON public.activities FOR ALL
  USING (public.get_user_type_secure() = 'platform_admin');

-- Invoice payments table - secure policies
CREATE POLICY "Platform admins can view all payment records - secure"
  ON public.invoice_payments FOR SELECT
  USING (public.get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can insert payment records - secure"
  ON public.invoice_payments FOR INSERT
  WITH CHECK (public.get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can update payment records - secure"
  ON public.invoice_payments FOR UPDATE
  USING (public.get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can delete payment records - secure"
  ON public.invoice_payments FOR DELETE
  USING (public.get_user_type_secure() = 'platform_admin');

-- Invoices table - secure policies
CREATE POLICY "Platform admins can manage all invoices - secure"
  ON public.invoices FOR ALL
  USING (public.get_user_type_secure() = 'platform_admin');

-- Job assignments table - secure policies
CREATE POLICY "Platform admins can manage all job assignments - secure"
  ON public.job_assignments FOR ALL
  USING (public.get_user_type_secure() = 'platform_admin');

-- Job candidates table - secure policies
CREATE POLICY "Platform admins can manage all job candidates - secure"
  ON public.job_candidates FOR ALL
  USING (public.get_user_type_secure() = 'platform_admin');

-- Job requests table - secure policies
CREATE POLICY "Platform admins can manage all job requests - secure"
  ON public.job_requests FOR ALL
  USING (public.get_user_type_secure() = 'platform_admin');

-- Jobs table - secure policies
CREATE POLICY "Platform admins can manage all jobs - secure"
  ON public.jobs FOR ALL
  USING (public.get_user_type_secure() = 'platform_admin');

-- Members table - secure policies
CREATE POLICY "Platform admins can manage all members - secure"
  ON public.members FOR ALL
  USING (public.get_user_type_secure() = 'platform_admin');

-- Organization custom data table - secure policies
CREATE POLICY "Platform admins can manage all organization custom data - secure"
  ON public.organization_custom_data FOR ALL
  USING (public.get_user_type_secure() = 'platform_admin');

-- Organizations table - secure policies
CREATE POLICY "Platform admins can manage all organizations - secure"
  ON public.organizations FOR ALL
  USING (public.get_user_type_secure() = 'platform_admin');

-- Profiles table - secure policies
CREATE POLICY "Platform admins can manage all profiles - secure"
  ON public.profiles FOR ALL
  USING (public.get_user_type_secure() = 'platform_admin');

-- Candidate comments table - secure policies
CREATE POLICY "Platform admins can manage all candidate comments - secure"
  ON public.candidate_comments FOR ALL
  USING (public.get_user_type_secure() = 'platform_admin');

-- Storage policies for invoice files - secure policies
CREATE POLICY "Platform admins can upload invoices - secure" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'invoices' AND
    public.get_user_type_secure() = 'platform_admin'
  );

CREATE POLICY "Platform admins can view all invoice files - secure" 
  ON storage.objects FOR SELECT 
  USING (
    bucket_id = 'invoices' AND
    public.get_user_type_secure() = 'platform_admin'
  );

-- Log the security fix completion
DO $$
BEGIN
  RAISE NOTICE 'SECURITY FIX COMPLETED: All unsafe user_metadata RLS policies have been replaced with secure database-based role checking.';
END $$;
