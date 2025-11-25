-- Fix the log_member_activation trigger function
DROP TRIGGER IF EXISTS trg_log_member_activation ON public.members;
DROP FUNCTION IF EXISTS public.log_member_activation();

CREATE OR REPLACE FUNCTION public.log_member_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  user_full_name TEXT;
  user_email TEXT;
BEGIN
  -- Only log when status changes to 'active'
  IF (TG_OP = 'UPDATE' AND NEW.user_status = 'active' AND OLD.user_status != 'active') 
     OR (TG_OP = 'INSERT' AND NEW.user_status = 'active') THEN
    
    -- Get user info from auth.users
    SELECT 
      COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        CONCAT(au.raw_user_meta_data->>'first_name', ' ', au.raw_user_meta_data->>'last_name')
      ),
      au.email
    INTO user_full_name, user_email
    FROM auth.users au
    WHERE au.id = NEW.user_id;
    
    -- Log the activation activity
    INSERT INTO public.activities (
      user_id,
      organization_id,
      tenant_id,
      activity_type,
      title,
      description,
      metadata
    ) VALUES (
      NEW.user_id,
      NEW.organization_id,
      NEW.tenant_id,
      'member_activated',
      'Team member joined',
      COALESCE(user_full_name, user_email, 'A new team member') || ' joined the team',
      jsonb_build_object(
        'member_id', NEW.id,
        'member_role', NEW.member_role,
        'user_type', NEW.user_type
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_member_activation
  AFTER INSERT OR UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.log_member_activation();

-- Clean up orphaned data for anirbanfiem@gmail.com (user_id: 2e6a6b01-f0cf-4580-9caa-2d116e0c8f21)

-- Delete any existing member records for this user first
DELETE FROM public.members 
WHERE user_id = '2e6a6b01-f0cf-4580-9caa-2d116e0c8f21';

-- Delete the 5 orphaned tenants/organizations (keep test workspace: 9f5cf27e-33e0-45f9-a346-39cb4ddea9fb)
DELETE FROM public.organizations 
WHERE id IN (
  '4cf2e612-30db-405f-a837-1c43d1d7d67f',
  '1e3dbea4-0743-445a-a0f1-af0d4f6130c9',
  'c15f6eef-b6ed-4e06-8d78-ed2a7c6a72f8',
  'e16aaa45-24d3-4e97-939e-be4bc40ffef7',
  'dc19cf42-cf72-4dbd-99fe-77cc7fd5ad7d'
);

-- Now insert the correct member record for the kept tenant (test workspace)
INSERT INTO public.members (
  user_id,
  organization_id,
  tenant_id,
  user_type,
  member_role,
  user_status
) VALUES (
  '2e6a6b01-f0cf-4580-9caa-2d116e0c8f21',
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb',
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb',
  'workspace_owner',
  'admin',
  'active'
);

-- Update the owner_id for test workspace
UPDATE public.organizations
SET owner_id = '2e6a6b01-f0cf-4580-9caa-2d116e0c8f21',
    updated_at = now()
WHERE id = '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb';

-- Create trial subscription for test workspace if it doesn't exist
INSERT INTO public.tenant_subscriptions (
  tenant_id,
  subscription_tier,
  billing_status,
  trial_started_at,
  trial_ends_at,
  trial_source
) VALUES (
  '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb',
  'launch',
  'trialing',
  now(),
  now() + INTERVAL '14 days',
  'self_signup'
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Update profile organization_id
UPDATE public.profiles
SET organization_id = '9f5cf27e-33e0-45f9-a346-39cb4ddea9fb',
    updated_at = now()
WHERE user_id = '2e6a6b01-f0cf-4580-9caa-2d116e0c8f21';