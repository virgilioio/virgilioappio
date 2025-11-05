
-- ============================================================================
-- MAJOR BACKEND REFACTORING: CLEANUP & SECURITY FIXES
-- ============================================================================
-- This migration performs three critical refactoring tasks:
-- 1. Drop all legacy "Platform admins can..." RLS policies (keeping consolidated ones)
-- 2. Fix SECURITY DEFINER functions missing search_path (security vulnerability)
-- 3. Drop redundant helper function variants (safe vs secure)
-- ============================================================================

-- ============================================================================
-- PART 1: DROP LEGACY RLS POLICIES
-- ============================================================================
-- These legacy policies conflict with the new consolidated policies and
-- create confusion. The consolidated policies handle platform admin access
-- through get_user_type_secure() checks within the policy logic.
-- ============================================================================

-- Activities
DROP POLICY IF EXISTS "Platform admins can view all activities" ON public.activities;
-- Keep: "Platform admins can manage all activities - secure"

-- Application Fields
DROP POLICY IF EXISTS "Platform admins can manage all application fields" ON public.application_fields;

-- Booking Configurations
DROP POLICY IF EXISTS "Platform admins can manage all booking configs" ON public.booking_configurations;

-- Candidate Application Responses
DROP POLICY IF EXISTS "Platform admins can manage all application responses" ON public.candidate_application_responses;

-- Candidate Attachments
DROP POLICY IF EXISTS "Platform admins can manage all candidate attachments" ON public.candidate_attachments;

-- Candidate Comments
DROP POLICY IF EXISTS "Platform admins can manage all candidate comments" ON public.candidate_comments;

-- Candidate Enrichment Logs
DROP POLICY IF EXISTS "Platform admins can manage enrichment logs" ON public.candidate_enrichment_logs;

-- Contract Templates
DROP POLICY IF EXISTS "Platform admins can manage all contract templates" ON public.contract_templates;

-- CoreSignal Usage
DROP POLICY IF EXISTS "Platform admins can manage all CoreSignal usage" ON public.coresignal_usage;

-- Email Templates
DROP POLICY IF EXISTS "Platform admins can manage all email templates" ON public.email_templates;

-- Job Assignments
-- Keep: "Platform admins can manage all job assignments - secure"

-- Job Candidate Associations
DROP POLICY IF EXISTS "Platform admins can manage all associations" ON public.job_candidate_associations;

-- Job Stages
DROP POLICY IF EXISTS "Platform admins can manage all job stages" ON public.job_stages;

-- Jobs (has consolidated policies)
DROP POLICY IF EXISTS "Platform admins can manage all jobs" ON public.jobs;
-- Keep: jobs_select_consolidated, jobs_insert_consolidated, etc.

-- Library Enrichment Logs
DROP POLICY IF EXISTS "Platform admins can manage all enrichment logs" ON public.library_enrichment_logs;

-- Members
DROP POLICY IF EXISTS "Platform admins can manage all members" ON public.members;

-- Offer Letters
DROP POLICY IF EXISTS "Platform admins can manage all offer letters" ON public.offer_letters;

-- Offer Template Fields
DROP POLICY IF EXISTS "Platform admins can manage all offer template fields" ON public.offer_template_fields;

-- Offer Templates
DROP POLICY IF EXISTS "Platform admins can manage all offer templates" ON public.offer_templates;

-- Organizations
DROP POLICY IF EXISTS "Platform admins can manage orgs" ON public.organizations;
DROP POLICY IF EXISTS "Platform admins can view all organization exchange rates" ON public.organizations;
-- Keep: "Platform admins can manage all organizations - secure"

-- Platform Assets
DROP POLICY IF EXISTS "Platform admins can manage platform assets" ON public.platform_assets;

-- Platform Feature Flags
DROP POLICY IF EXISTS "Platform admins can view feature flags" ON public.platform_feature_flags;
DROP POLICY IF EXISTS "Platform admins can manage feature flags" ON public.platform_feature_flags;

-- Profiles
DROP POLICY IF EXISTS "Platform admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Platform admins can manage all profiles" ON public.profiles;

-- Salary Market Data
DROP POLICY IF EXISTS "Platform admins can manage salary data" ON public.salary_market_data;

-- Scheduled Bookings
DROP POLICY IF EXISTS "Platform admins can manage all bookings" ON public.scheduled_bookings;

-- Stage Automation Emails
DROP POLICY IF EXISTS "Platform admins can manage all stage automation emails" ON public.stage_automation_emails;

-- Stage Interviewer Assignments
DROP POLICY IF EXISTS "Platform admins can manage all interviewer assignments" ON public.stage_interviewer_assignments;

-- Standard Skills
DROP POLICY IF EXISTS "Platform admins can manage standard skills" ON public.standard_skills;

-- Standard Job Titles
DROP POLICY IF EXISTS "Platform admins can manage standard job titles" ON public.standard_job_titles;

-- Standard Locations
DROP POLICY IF EXISTS "Platform admins can manage standard locations" ON public.standard_locations;

-- Tenant Subscriptions
DROP POLICY IF EXISTS "Platform admins can manage all tenant subscriptions" ON public.tenant_subscriptions;

-- User Mail Identities
DROP POLICY IF EXISTS "Platform admins can manage all mail identities" ON public.user_mail_identities;

-- Job Hiring Stages
DROP POLICY IF EXISTS "Platform admins can manage all job hiring stages" ON public.job_hiring_stages;


-- ============================================================================
-- PART 2: FIX SECURITY DEFINER FUNCTIONS MISSING search_path
-- ============================================================================
-- Functions without SET search_path are vulnerable to search_path hijacking.
-- This is a critical security issue that must be fixed.
-- ============================================================================

-- Fix: test_get_user_organization_id (missing search_path)
DROP FUNCTION IF EXISTS public.test_get_user_organization_id();

CREATE OR REPLACE FUNCTION public.test_get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  org_id uuid;
BEGIN
  SELECT organization_id INTO org_id
  FROM public.members
  WHERE user_id = auth.uid()
    AND user_status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN org_id;
END;
$$;

COMMENT ON FUNCTION public.test_get_user_organization_id() IS 
'Test function to get user organization. SECURITY DEFINER with search_path protection.';


-- ============================================================================
-- PART 3: DROP REDUNDANT HELPER FUNCTION VARIANTS
-- ============================================================================
-- We have both "safe" and "secure" variants of the same functions.
-- Current policies only use "secure" variants, so we can drop the "safe" ones.
-- ============================================================================

-- Drop redundant get_user_type_safe() - replaced by get_user_type_secure()
DROP FUNCTION IF EXISTS public.get_user_type_safe();

-- Drop redundant get_member_role_safe() - replaced by get_member_role()
DROP FUNCTION IF EXISTS public.get_member_role_safe();


-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the cleanup)
-- ============================================================================

-- Verify no more legacy platform admin policies
DO $$
DECLARE
  legacy_count integer;
BEGIN
  SELECT COUNT(*) INTO legacy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname ILIKE '%platform admin%'
    AND policyname NOT ILIKE '%secure%';
    
  RAISE NOTICE 'Remaining legacy platform admin policies: %', legacy_count;
  
  IF legacy_count > 0 THEN
    RAISE NOTICE 'Legacy policies still exist - please review';
  ELSE
    RAISE NOTICE '✓ All legacy platform admin policies successfully removed';
  END IF;
END $$;

-- Verify all SECURITY DEFINER functions have search_path
DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prosecdef = true
    AND n.nspname = 'public'
    AND (
      p.proconfig IS NULL 
      OR NOT EXISTS (
        SELECT 1 
        FROM unnest(p.proconfig) cfg 
        WHERE cfg LIKE 'search_path=%'
      )
    );
    
  RAISE NOTICE 'SECURITY DEFINER functions missing search_path: %', missing_count;
  
  IF missing_count > 0 THEN
    RAISE WARNING 'Some functions still missing search_path - security risk!';
  ELSE
    RAISE NOTICE '✓ All SECURITY DEFINER functions have search_path protection';
  END IF;
END $$;

-- List remaining platform admin policies (should all be "secure" variants)
SELECT 
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname ILIKE '%platform admin%'
ORDER BY tablename, policyname;
