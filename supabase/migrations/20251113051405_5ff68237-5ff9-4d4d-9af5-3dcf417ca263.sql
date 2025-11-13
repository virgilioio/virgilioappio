-- Clean up orphaned Motive tenant records
-- These tenants have no associated data (0 orgs, 0 members, 0 subscriptions, 0 jobs)
-- Created during troubleshooting before dual-insert strategy was implemented
-- Only the properly provisioned tenant (dd0e4d9f-8a04-45cc-90f0-ba8f82d39506) should remain

DELETE FROM public.tenants 
WHERE id IN (
  '94a4702b-6332-4ba0-86c2-dbc70b233349',
  'a0924cde-2246-441f-8c85-681fc3487996'
);