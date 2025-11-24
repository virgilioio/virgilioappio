-- Initialize careers_page_settings for all tenants that don't have one yet
INSERT INTO public.careers_page_settings (
  tenant_id,
  company_slug,
  page_title,
  show_company_name,
  is_active,
  created_by
)
SELECT 
  t.id as tenant_id,
  NULL as company_slug, -- Trigger will auto-generate from tenant name
  'Careers' as page_title,
  true as show_company_name,
  true as is_active,
  COALESCE(
    (SELECT user_id FROM public.members 
     WHERE tenant_id = t.id 
     AND member_role IN ('admin') OR user_type IN ('workspace_owner', 'platform_admin')
     AND user_status = 'active'
     ORDER BY created_at 
     LIMIT 1),
    (SELECT user_id FROM public.members 
     WHERE tenant_id = t.id 
     AND user_status = 'active'
     ORDER BY created_at 
     LIMIT 1)
  ) as created_by
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.careers_page_settings cps 
  WHERE cps.tenant_id = t.id
);