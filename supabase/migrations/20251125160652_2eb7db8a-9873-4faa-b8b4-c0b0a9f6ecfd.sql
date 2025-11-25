-- Comprehensive cleanup: Delete 5 orphaned tenant records and all related data
-- This will clean up the SaaS Customers list to show only the active "Wiki" tenant

-- Step 1: Delete activities for these tenants
DELETE FROM public.activities 
WHERE tenant_id IN (
  '63152268-1c8f-47bd-8bed-11bb7abf7ad8',
  '57cd41f3-af0a-4843-a5e1-4cd66a22edad',
  'c844a73f-4a53-4cfc-a5df-94956749d00f',
  '925f437c-6d49-47c7-93e9-5d359599d223',
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb'
);

-- Step 2: Delete email rate limits for these tenants
DELETE FROM public.email_rate_limits 
WHERE tenant_id IN (
  '63152268-1c8f-47bd-8bed-11bb7abf7ad8',
  '57cd41f3-af0a-4843-a5e1-4cd66a22edad',
  'c844a73f-4a53-4cfc-a5df-94956749d00f',
  '925f437c-6d49-47c7-93e9-5d359599d223',
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb'
);

-- Step 3: Delete email suppression list entries for these tenants
DELETE FROM public.email_suppression_list 
WHERE tenant_id IN (
  '63152268-1c8f-47bd-8bed-11bb7abf7ad8',
  '57cd41f3-af0a-4843-a5e1-4cd66a22edad',
  'c844a73f-4a53-4cfc-a5df-94956749d00f',
  '925f437c-6d49-47c7-93e9-5d359599d223',
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb'
);

-- Step 4: Delete calendar identities for these tenants
DELETE FROM public.calendar_identities 
WHERE tenant_id IN (
  '63152268-1c8f-47bd-8bed-11bb7abf7ad8',
  '57cd41f3-af0a-4843-a5e1-4cd66a22edad',
  'c844a73f-4a53-4cfc-a5df-94956749d00f',
  '925f437c-6d49-47c7-93e9-5d359599d223',
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb'
);

-- Step 5: Delete AI conversations for these tenants
DELETE FROM public.ai_conversations 
WHERE tenant_id IN (
  '63152268-1c8f-47bd-8bed-11bb7abf7ad8',
  '57cd41f3-af0a-4843-a5e1-4cd66a22edad',
  'c844a73f-4a53-4cfc-a5df-94956749d00f',
  '925f437c-6d49-47c7-93e9-5d359599d223',
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb'
);

-- Step 6: Delete application fields for these tenants
DELETE FROM public.application_fields 
WHERE tenant_id IN (
  '63152268-1c8f-47bd-8bed-11bb7abf7ad8',
  '57cd41f3-af0a-4843-a5e1-4cd66a22edad',
  'c844a73f-4a53-4cfc-a5df-94956749d00f',
  '925f437c-6d49-47c7-93e9-5d359599d223',
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb'
);

-- Step 7: Delete contract templates for these tenants
DELETE FROM public.contract_templates 
WHERE tenant_id IN (
  '63152268-1c8f-47bd-8bed-11bb7abf7ad8',
  '57cd41f3-af0a-4843-a5e1-4cd66a22edad',
  'c844a73f-4a53-4cfc-a5df-94956749d00f',
  '925f437c-6d49-47c7-93e9-5d359599d223',
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb'
);

-- Step 8: Delete careers page settings for these tenants
DELETE FROM public.careers_page_settings 
WHERE tenant_id IN (
  '63152268-1c8f-47bd-8bed-11bb7abf7ad8',
  '57cd41f3-af0a-4843-a5e1-4cd66a22edad',
  'c844a73f-4a53-4cfc-a5df-94956749d00f',
  '925f437c-6d49-47c7-93e9-5d359599d223',
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb'
);

-- Step 9: Delete job board integrations for these tenants
DELETE FROM public.job_board_integrations 
WHERE tenant_id IN (
  '63152268-1c8f-47bd-8bed-11bb7abf7ad8',
  '57cd41f3-af0a-4843-a5e1-4cd66a22edad',
  'c844a73f-4a53-4cfc-a5df-94956749d00f',
  '925f437c-6d49-47c7-93e9-5d359599d223',
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb'
);

-- Step 10: Delete candidates for these tenants
DELETE FROM public.candidates 
WHERE tenant_id IN (
  '63152268-1c8f-47bd-8bed-11bb7abf7ad8',
  '57cd41f3-af0a-4843-a5e1-4cd66a22edad',
  'c844a73f-4a53-4cfc-a5df-94956749d00f',
  '925f437c-6d49-47c7-93e9-5d359599d223',
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb'
);

-- Step 11: Delete email logs for these tenants
DELETE FROM public.email_logs 
WHERE tenant_id IN (
  '63152268-1c8f-47bd-8bed-11bb7abf7ad8',
  '57cd41f3-af0a-4843-a5e1-4cd66a22edad',
  'c844a73f-4a53-4cfc-a5df-94956749d00f',
  '925f437c-6d49-47c7-93e9-5d359599d223',
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb'
);

-- Step 12: Finally, delete the 5 orphaned tenant records
DELETE FROM public.tenants 
WHERE id IN (
  '63152268-1c8f-47bd-8bed-11bb7abf7ad8',  -- WikiCom
  '57cd41f3-af0a-4843-a5e1-4cd66a22edad',  -- testWS
  'c844a73f-4a53-4cfc-a5df-94956749d00f',  -- gbwedbwcd
  '925f437c-6d49-47c7-93e9-5d359599d223',  -- gbwedbwcd
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb'   -- test workspace
);