
-- Drop the global constraint (email + name across ALL tenants)
ALTER TABLE public.candidates
DROP CONSTRAINT IF EXISTS candidates_email_candidate_name_key;

-- Add the correct tenant-scoped unique constraint
ALTER TABLE public.candidates
ADD CONSTRAINT candidates_email_candidate_name_tenant_key
UNIQUE (email, candidate_name, tenant_id);

-- Step 1: Delete the wrong association (Motive candidate → Virgilio job)
DELETE FROM public.job_candidate_associations
WHERE id = 'eeae5777-a408-486d-9c36-f39c6577bc95';

-- Step 2: Also delete any other wrong associations for this job pointing to wrong-tenant candidates
DELETE FROM public.job_candidate_associations jca
WHERE jca.job_id = '90e0e9bd-4aa5-4944-99d0-6251778fa650'
  AND jca.candidate_id IN (
    SELECT c.id FROM public.candidates c
    WHERE c.email = 'jvbonifaz@gmail.com'
      AND c.tenant_id != '5ba7b145-f251-4b18-8900-724cb06028ab'
  );

-- Step 3: Create the correct Virgilio candidate (only if not already exists)
INSERT INTO public.candidates (
  candidate_name, email, organization_id, tenant_id, source, created_by
)
SELECT
  'Josel Valadez Bonifaz',
  'jvbonifaz@gmail.com',
  '6778ef5b-d05f-4883-b80c-3d9843ba5a95',
  '5ba7b145-f251-4b18-8900-724cb06028ab',
  'public_posting',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.candidates
  WHERE email = 'jvbonifaz@gmail.com'
    AND tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'
);

-- Step 4: Migrate application responses to point to the new Virgilio candidate
-- (update candidate_id in candidate_application_responses for the Marketing Content Writer job)
UPDATE public.candidate_application_responses
SET candidate_id = (
  SELECT id FROM public.candidates
  WHERE email = 'jvbonifaz@gmail.com'
    AND tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'
  LIMIT 1
)
WHERE job_id = '90e0e9bd-4aa5-4944-99d0-6251778fa650'
  AND candidate_id IN (
    SELECT id FROM public.candidates
    WHERE email = 'jvbonifaz@gmail.com'
      AND tenant_id != '5ba7b145-f251-4b18-8900-724cb06028ab'
  );

-- Step 5: Create the correct job association pointing to the new Virgilio candidate
INSERT INTO public.job_candidate_associations (
  job_id, candidate_id, status, current_stage_id
)
SELECT
  '90e0e9bd-4aa5-4944-99d0-6251778fa650',
  id,
  'active',
  NULL
FROM public.candidates
WHERE email = 'jvbonifaz@gmail.com'
  AND tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'
AND NOT EXISTS (
  SELECT 1 FROM public.job_candidate_associations
  WHERE job_id = '90e0e9bd-4aa5-4944-99d0-6251778fa650'
    AND candidate_id = (
      SELECT id FROM public.candidates
      WHERE email = 'jvbonifaz@gmail.com'
        AND tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'
      LIMIT 1
    )
);
