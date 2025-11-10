-- Phase 4 (MVP): Tenant-Aware Storage & Download Audit Logging
-- Migration: 20251110_storage_tenant_paths_and_audit.sql

-- ============================================================================
-- 4.1 Helper Functions for Tenant-Aware Paths
-- ============================================================================

-- Helper function to extract tenant_id from candidate
CREATE OR REPLACE FUNCTION public.get_candidate_tenant_id(candidate_id_param uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.tenant_id 
  FROM public.candidates c 
  WHERE c.id = candidate_id_param;
$$;

-- Helper to get user's tenant
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.tenant_id 
  FROM public.members m 
  WHERE m.user_id = auth.uid() 
    AND m.user_status = 'active'
  LIMIT 1;
$$;

-- ============================================================================
-- 4.2 Simplify Storage RLS with Tenant Paths
-- ============================================================================

-- Drop existing complex policies on storage.objects for candidate-attachments
DROP POLICY IF EXISTS "Users can view candidate attachments they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload candidate attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their uploaded attachments" ON storage.objects;

-- NEW: Simpler tenant-aware SELECT policy
CREATE POLICY "tenant_access_candidate_files" 
ON storage.objects FOR SELECT
USING (
  bucket_id = 'candidate-attachments' 
  AND (
    -- Platform admins can see all
    public.get_user_type_secure() = 'platform_admin'
    OR
    -- Users can see files in their tenant's folder (new path structure)
    (
      (storage.foldername(name))[1] = 'tenants'
      AND (storage.foldername(name))[2]::uuid IN (
        SELECT tenant_id FROM public.members WHERE user_id = auth.uid() AND user_status = 'active'
      )
    )
    OR
    -- Backward compatibility: old path structure (candidateId/filename)
    -- Check if user has access to the candidate via tenant membership
    EXISTS (
      SELECT 1 FROM public.candidate_attachments ca
      JOIN public.candidates c ON c.id = ca.candidate_id
      JOIN public.members m ON m.tenant_id = c.tenant_id
      WHERE ca.file_url = name
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
    )
  )
);

-- NEW: Tenant-aware INSERT policy with file validation
CREATE POLICY "tenant_upload_candidate_files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'candidate-attachments'
  AND (
    -- New path structure validation
    (
      (storage.foldername(name))[1] = 'tenants'
      AND (storage.foldername(name))[2]::uuid = public.get_user_tenant_id()
    )
    OR
    -- Backward compatibility: allow old path structure for now
    (
      public.get_user_tenant_id() IS NOT NULL
    )
  )
  -- File type validation
  AND (metadata->>'mimetype' IN (
    'application/pdf',
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'text/plain'
  ))
  -- Max 15MB
  AND (metadata->>'size')::bigint < 15728640
);

-- NEW: Tenant-aware DELETE policy
CREATE POLICY "tenant_delete_candidate_files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'candidate-attachments'
  AND (
    public.get_user_type_secure() = 'platform_admin'
    OR (
      -- New path structure: check tenant ownership
      (
        (storage.foldername(name))[1] = 'tenants'
        AND (storage.foldername(name))[2]::uuid = public.get_user_tenant_id()
      )
      OR
      -- Old path structure: check attachment ownership
      EXISTS (
        SELECT 1 FROM public.candidate_attachments ca
        WHERE ca.file_url = name
        AND ca.uploaded_by = auth.uid()
      )
    )
  )
);

-- ============================================================================
-- 4.3 Download Audit Logging
-- ============================================================================

-- Create download_logs table in audit schema
CREATE TABLE audit.download_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  tenant_id uuid REFERENCES public.organizations(id),
  file_path text NOT NULL,
  file_type text, -- 'resume', 'attachment', 'offer_letter'
  entity_id uuid, -- candidate_id, offer_id, etc.
  accessed_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Indexes for querying
CREATE INDEX idx_download_logs_tenant ON audit.download_logs(tenant_id, accessed_at DESC);
CREATE INDEX idx_download_logs_user ON audit.download_logs(user_id, accessed_at DESC);
CREATE INDEX idx_download_logs_entity ON audit.download_logs(entity_id, accessed_at DESC);

-- Enable RLS
ALTER TABLE audit.download_logs ENABLE ROW LEVEL SECURITY;

-- RLS: Platform admins can view all download logs
CREATE POLICY "platform_admins_view_downloads"
ON audit.download_logs FOR SELECT
USING (public.get_user_type_secure() = 'platform_admin');

-- RLS: Workspace owners can view their tenant's download logs
CREATE POLICY "workspace_owners_view_tenant_downloads"
ON audit.download_logs FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.members 
    WHERE user_id = auth.uid() 
    AND user_type = 'workspace_owner'
    AND user_status = 'active'
  )
);

-- RLS: Allow authenticated users to insert download logs (via edge function)
CREATE POLICY "authenticated_insert_download_logs"
ON audit.download_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Add comment for documentation
COMMENT ON TABLE audit.download_logs IS 'Audit trail for file downloads (resumes, attachments, offer letters). Part of Phase 4 MVP security implementation.';