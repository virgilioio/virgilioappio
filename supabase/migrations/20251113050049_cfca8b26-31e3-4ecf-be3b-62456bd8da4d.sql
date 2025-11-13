-- Phase 1: Clean up orphaned "Motive" tenant records
-- These 3 tenants were created but never completed provisioning
-- They have no members, no subscriptions, no root organizations - safe to delete

DELETE FROM public.tenants 
WHERE id IN (
  'ba2e0540-0da4-46eb-acf7-bbf0c2fee64f',
  '3eefdc34-62e1-47e1-b1a8-ac8b33ba3e2c',
  '98dc2eb1-4b0a-4cb5-9a2c-af5a0e7b5f27'
) AND name = 'Motive';