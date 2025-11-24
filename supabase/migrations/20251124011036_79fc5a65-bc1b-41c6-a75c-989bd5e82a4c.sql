-- Create onboarding_progress table
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Task completion tracking (auto-detected)
  task_profile_complete BOOLEAN DEFAULT false,
  task_booking_configured BOOLEAN DEFAULT false,
  task_organization_created BOOLEAN DEFAULT false,
  task_job_created BOOLEAN DEFAULT false,
  task_candidate_created BOOLEAN DEFAULT false,
  task_team_invited BOOLEAN DEFAULT false,
  
  -- Manual override flags (if user manually marks as done)
  task_profile_manual BOOLEAN DEFAULT false,
  task_booking_manual BOOLEAN DEFAULT false,
  task_organization_manual BOOLEAN DEFAULT false,
  task_job_manual BOOLEAN DEFAULT false,
  task_candidate_manual BOOLEAN DEFAULT false,
  task_team_manual BOOLEAN DEFAULT false,
  
  -- Metadata
  dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own onboarding progress"
  ON public.onboarding_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding progress"
  ON public.onboarding_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding progress"
  ON public.onboarding_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to auto-create onboarding record when profile is created
CREATE OR REPLACE FUNCTION public.create_onboarding_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the user's tenant_id from their active membership
  INSERT INTO public.onboarding_progress (user_id, tenant_id)
  SELECT NEW.user_id, m.tenant_id
  FROM public.members m
  WHERE m.user_id = NEW.user_id
    AND m.user_status = 'active'
  LIMIT 1
  ON CONFLICT (user_id, tenant_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create onboarding progress when profile is created
CREATE TRIGGER on_profile_created_create_onboarding
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_onboarding_progress();

-- Function to check and update onboarding task completion
CREATE OR REPLACE FUNCTION public.check_onboarding_task_completion(
  p_user_id UUID,
  p_tenant_id UUID
) RETURNS void AS $$
DECLARE
  v_profile_complete BOOLEAN;
  v_booking_configured BOOLEAN;
  v_org_created BOOLEAN;
  v_job_created BOOLEAN;
  v_candidate_created BOOLEAN;
  v_team_invited BOOLEAN;
  v_all_complete BOOLEAN;
BEGIN
  -- Check profile completion (all required fields filled)
  SELECT (
    first_name IS NOT NULL AND first_name != '' AND
    last_name IS NOT NULL AND last_name != '' AND
    title IS NOT NULL AND title != '' AND
    phone IS NOT NULL AND phone != '' AND
    timezone IS NOT NULL AND timezone != ''
  )
  INTO v_profile_complete
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  -- Check booking configuration
  SELECT EXISTS(
    SELECT 1 FROM public.booking_configurations 
    WHERE user_id = p_user_id AND is_active = true
  ) INTO v_booking_configured;
  
  -- Check organization created (child orgs in their tenant)
  SELECT EXISTS(
    SELECT 1 FROM public.organizations 
    WHERE tenant_id = p_tenant_id 
    AND org_kind = 'organization'
  ) INTO v_org_created;
  
  -- Check job created
  SELECT EXISTS(
    SELECT 1 FROM public.jobs WHERE tenant_id = p_tenant_id
  ) INTO v_job_created;
  
  -- Check candidate created
  SELECT EXISTS(
    SELECT 1 FROM public.candidates WHERE tenant_id = p_tenant_id
  ) INTO v_candidate_created;
  
  -- Check team invited (at least 2 members: owner + 1 more)
  SELECT (COUNT(*) > 1)
  INTO v_team_invited
  FROM public.members
  WHERE tenant_id = p_tenant_id
  AND user_status IN ('active', 'invited');
  
  -- Calculate if all tasks are complete
  v_all_complete := v_profile_complete AND v_booking_configured AND 
                    v_org_created AND v_job_created AND 
                    v_candidate_created AND v_team_invited;
  
  -- Update onboarding progress
  UPDATE public.onboarding_progress
  SET 
    task_profile_complete = v_profile_complete,
    task_booking_configured = v_booking_configured,
    task_organization_created = v_org_created,
    task_job_created = v_job_created,
    task_candidate_created = v_candidate_created,
    task_team_invited = v_team_invited,
    completed_at = CASE 
      WHEN v_all_complete THEN COALESCE(completed_at, now()) 
      ELSE NULL 
    END,
    updated_at = now()
  WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;