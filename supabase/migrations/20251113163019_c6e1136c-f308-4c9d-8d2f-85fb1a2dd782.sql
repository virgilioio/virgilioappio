-- Final cleanup: Delete Motive tenant and root organization
-- Previous migration already removed all dependent records

DO $$
DECLARE
  v_tenant_id UUID := '87f1f95e-891d-4525-874c-2cc131a028e3';
BEGIN
  -- Delete organization (root org with same ID as tenant)
  DELETE FROM organizations 
  WHERE id = v_tenant_id;
  RAISE NOTICE 'Deleted organization: %', v_tenant_id;
  
  -- Delete tenant
  DELETE FROM tenants 
  WHERE id = v_tenant_id;
  RAISE NOTICE 'Deleted tenant: %', v_tenant_id;
  
  RAISE NOTICE '✅ Final Motive cleanup complete';
  RAISE NOTICE '⚠️  User must manually delete Auth user: 7755f1be-4dce-4712-831c-b0241a3ef6e1';
END $$;