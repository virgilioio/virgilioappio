-- INSERT: org members with recruiter+ role can create offer letters
CREATE POLICY offer_letters_insert_policy
  ON public.offer_letters FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND check_org_hierarchy_role_access(organization_id, 'recruiter')
  );

-- UPDATE: org members with recruiter+ role can update offer letters
CREATE POLICY offer_letters_update_policy
  ON public.offer_letters FOR UPDATE
  TO authenticated
  USING (check_org_hierarchy_role_access(organization_id, 'recruiter'))
  WITH CHECK (check_org_hierarchy_role_access(organization_id, 'recruiter'));

-- DELETE: org admins only
CREATE POLICY offer_letters_delete_policy
  ON public.offer_letters FOR DELETE
  TO authenticated
  USING (check_org_hierarchy_role_access(organization_id, 'admin'));