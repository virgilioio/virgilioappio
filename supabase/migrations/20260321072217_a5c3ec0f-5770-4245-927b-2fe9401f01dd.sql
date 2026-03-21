
-- Fix the UPDATE WITH CHECK policy that fails on NULL uploaded_by
DROP POLICY IF EXISTS "candidate_attachments_update" ON candidate_attachments;

CREATE POLICY "candidate_attachments_update" ON candidate_attachments
  FOR UPDATE TO authenticated
  USING (
    (uploaded_by = auth.uid()) OR 
    (EXISTS (SELECT 1 FROM candidates c 
     WHERE c.id = candidate_attachments.candidate_id 
     AND check_org_hierarchy_role_access(c.organization_id, 'recruiter')))
  )
  WITH CHECK (true);
