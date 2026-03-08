CREATE POLICY "tenants_users_update_own"
ON public.tenants
FOR UPDATE
TO authenticated
USING (user_has_tenant_access(id))
WITH CHECK (user_has_tenant_access(id));