INSERT INTO public.organizations (id, name, org_kind, status, tenant_id, parent_organization_id)
SELECT gen_random_uuid(), 'General', 'department', 'active', t.id, t.id
FROM public.tenants t
WHERE t.tenant_type = 'saas' AND t.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.tenant_id = t.id AND o.parent_organization_id IS NOT NULL
  );