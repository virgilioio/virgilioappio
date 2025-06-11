
-- Fix RLS Policy Conflicts and Security Issues for Billing System
-- This migration consolidates policies and ensures proper org-scoped access

-- Step 1: Drop all existing conflicting RLS policies on invoices table
DROP POLICY IF EXISTS "Platform admins can manage all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Billing members can manage org invoices" ON public.invoices;
DROP POLICY IF EXISTS "Workspace owners can view org invoices" ON public.invoices;
DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;

-- Step 2: Create consolidated, secure RLS policies for invoices table
-- SELECT Policy: Platform admins see all, others see only their org (must have org context)
CREATE POLICY "invoices_consolidated_select_policy" ON public.invoices
FOR SELECT 
TO authenticated
USING (
  get_user_type() = 'platform_admin' 
  OR (
    get_user_organization_id() IS NOT NULL 
    AND organization_id = get_user_organization_id()
  )
);

-- INSERT Policy: Platform admins and billing members can create
CREATE POLICY "invoices_consolidated_insert_policy" ON public.invoices
FOR INSERT 
TO authenticated
WITH CHECK (
  get_user_type() = 'platform_admin'
  OR (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND member_role = 'billing'
      AND organization_id = invoices.organization_id
    )
  )
);

-- UPDATE Policy: Platform admins and billing members can update
CREATE POLICY "invoices_consolidated_update_policy" ON public.invoices
FOR UPDATE 
TO authenticated
USING (
  get_user_type() = 'platform_admin'
  OR (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND member_role = 'billing'
      AND organization_id = invoices.organization_id
    )
  )
);

-- DELETE Policy: Platform admins and billing members can delete
CREATE POLICY "invoices_consolidated_delete_policy" ON public.invoices
FOR DELETE 
TO authenticated
USING (
  get_user_type() = 'platform_admin'
  OR (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND member_role = 'billing'
      AND organization_id = invoices.organization_id
    )
  )
);

-- Step 3: Fix storage policies for invoice files
-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Platform admins can view all invoice files" ON storage.objects;
DROP POLICY IF EXISTS "Billing members can view org invoice files" ON storage.objects;
DROP POLICY IF EXISTS "Workspace owners can view org invoice files" ON storage.objects;

-- Create consolidated storage SELECT policy that includes clients
CREATE POLICY "invoices_storage_consolidated_select_policy" ON storage.objects
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'invoices' AND (
    -- Platform admins can access all files
    get_user_type() = 'platform_admin'
    OR (
      -- Users with org context can access their org's files
      get_user_organization_id() IS NOT NULL 
      AND name LIKE concat(get_user_organization_id()::text, '/%')
    )
  )
);

-- Ensure the invoices storage bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;
