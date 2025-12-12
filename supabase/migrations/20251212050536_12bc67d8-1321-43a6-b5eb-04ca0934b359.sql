-- Step 1: Backfill missing tenant_id on candidates table
-- Derive tenant_id from job_candidate_associations -> jobs relationship
UPDATE public.candidates c
SET tenant_id = j.tenant_id
FROM public.job_candidate_associations jca
JOIN public.jobs j ON j.id = jca.job_id
WHERE c.id = jca.candidate_id
  AND c.tenant_id IS NULL
  AND j.tenant_id IS NOT NULL;

-- Step 2: For any remaining candidates without tenant_id, try via organization_id
UPDATE public.candidates c
SET tenant_id = o.tenant_id
FROM public.organizations o
WHERE c.organization_id = o.id
  AND c.tenant_id IS NULL
  AND o.tenant_id IS NOT NULL;

-- Step 3: Drop old tenant-path RLS policy and create simplified one
DROP POLICY IF EXISTS "tenant_access_candidate_files" ON storage.objects;

CREATE POLICY "tenant_access_candidate_files" 
ON storage.objects FOR SELECT
USING (
  bucket_id = 'candidate-attachments' 
  AND (
    -- Platform admins can access all files
    public.get_user_type_secure() = 'platform_admin'
    OR
    -- Tenant members can access files linked to their candidates
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