-- Create enums
CREATE TYPE automation_type AS ENUM ('single_email', 'email_sequence');
CREATE TYPE trigger_event_type AS ENUM ('on_stage_enter', 'on_stage_exit');
CREATE TYPE delay_unit AS ENUM ('days', 'weeks');
CREATE TYPE email_send_to AS ENUM ('candidate', 'hiring_team', 'interviewers', 'custom');
CREATE TYPE queue_status AS ENUM ('pending', 'sent', 'failed', 'cancelled');

-- Table: stage_automations
CREATE TABLE public.stage_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_hiring_stage_id UUID NOT NULL REFERENCES public.job_hiring_stages(id) ON DELETE CASCADE,
  automation_type automation_type NOT NULL,
  trigger_event trigger_event_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stage_automations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stage_automations
CREATE POLICY "Org members can view stage automations"
  ON public.stage_automations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.job_hiring_stages jhs
      JOIN public.jobs j ON j.id = jhs.job_id
      JOIN public.members m ON m.organization_id = j.organization_id
      WHERE jhs.id = stage_automations.job_hiring_stage_id
        AND m.user_id = auth.uid()
        AND m.user_status = 'active'
    )
  );

CREATE POLICY "Org recruiters can manage stage automations"
  ON public.stage_automations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.job_hiring_stages jhs
      JOIN public.jobs j ON j.id = jhs.job_id
      JOIN public.members m ON m.organization_id = j.organization_id
      WHERE jhs.id = stage_automations.job_hiring_stage_id
        AND m.user_id = auth.uid()
        AND m.user_status = 'active'
        AND (m.member_role IN ('admin', 'recruiter') OR m.user_type = 'workspace_owner')
    )
  );

-- Table: stage_automation_emails
CREATE TABLE public.stage_automation_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_automation_id UUID NOT NULL REFERENCES public.stage_automations(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL DEFAULT 1,
  delay_value INTEGER,
  delay_unit delay_unit,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_interval_value INTEGER,
  recurrence_interval_unit delay_unit,
  max_occurrences INTEGER DEFAULT 10,
  email_template_id UUID REFERENCES public.email_templates(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  from_email TEXT NOT NULL,
  send_to email_send_to NOT NULL,
  custom_recipients TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT recurring_emails_must_have_interval 
    CHECK (
      NOT is_recurring OR 
      (recurrence_interval_value IS NOT NULL AND recurrence_interval_unit IS NOT NULL)
    )
);

-- Enable RLS
ALTER TABLE public.stage_automation_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stage_automation_emails
CREATE POLICY "Org members can view automation emails"
  ON public.stage_automation_emails FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stage_automations sa
      JOIN public.job_hiring_stages jhs ON jhs.id = sa.job_hiring_stage_id
      JOIN public.jobs j ON j.id = jhs.job_id
      JOIN public.members m ON m.organization_id = j.organization_id
      WHERE sa.id = stage_automation_emails.stage_automation_id
        AND m.user_id = auth.uid()
        AND m.user_status = 'active'
    )
  );

CREATE POLICY "Org recruiters can manage automation emails"
  ON public.stage_automation_emails FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.stage_automations sa
      JOIN public.job_hiring_stages jhs ON jhs.id = sa.job_hiring_stage_id
      JOIN public.jobs j ON j.id = jhs.job_id
      JOIN public.members m ON m.organization_id = j.organization_id
      WHERE sa.id = stage_automation_emails.stage_automation_id
        AND m.user_id = auth.uid()
        AND m.user_status = 'active'
        AND (m.member_role IN ('admin', 'recruiter') OR m.user_type = 'workspace_owner')
    )
  );

-- Table: automation_email_queue
CREATE TABLE public.automation_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_automation_email_id UUID NOT NULL REFERENCES public.stage_automation_emails(id) ON DELETE CASCADE,
  job_candidate_association_id UUID NOT NULL REFERENCES public.job_candidate_associations(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status queue_status NOT NULL DEFAULT 'pending',
  occurrence_number INTEGER DEFAULT 1,
  parent_queue_id UUID REFERENCES public.automation_email_queue(id),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_email_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policy for queue
CREATE POLICY "Org members can view email queue"
  ON public.automation_email_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.job_candidate_associations jca
      JOIN public.jobs j ON j.id = jca.job_id
      JOIN public.members m ON m.organization_id = j.organization_id
      WHERE jca.id = automation_email_queue.job_candidate_association_id
        AND m.user_id = auth.uid()
        AND m.user_status = 'active'
    )
  );

-- Index for efficient queue processing
CREATE INDEX idx_queue_pending ON public.automation_email_queue (status, scheduled_for) WHERE status = 'pending';

-- Function: should_stop_automation
CREATE OR REPLACE FUNCTION public.should_stop_automation(
  p_jca_id UUID,
  p_job_id UUID
) RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_candidate_status TEXT;
  v_job_status TEXT;
BEGIN
  SELECT 
    c.status,
    j.status
  INTO 
    v_candidate_status,
    v_job_status
  FROM public.job_candidate_associations jca
  JOIN public.candidates c ON c.id = jca.candidate_id
  JOIN public.jobs j ON j.id = jca.job_id
  WHERE jca.id = p_jca_id AND j.id = p_job_id;
  
  IF v_candidate_status != 'active' OR v_job_status != 'open' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Trigger function: trigger_stage_automation
CREATE OR REPLACE FUNCTION public.trigger_stage_automation() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_automation RECORD;
  v_email RECORD;
  v_scheduled_time TIMESTAMPTZ;
  v_previous_queue_id UUID;
BEGIN
  IF NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id THEN
    UPDATE public.automation_email_queue
    SET status = 'cancelled', updated_at = now()
    WHERE job_candidate_association_id = NEW.id
      AND status = 'pending';
    
    FOR v_automation IN
      SELECT * FROM public.stage_automations
      WHERE job_hiring_stage_id = NEW.current_stage_id
        AND trigger_event = 'on_stage_enter'
        AND is_active = true
    LOOP
      v_previous_queue_id := NULL;
      
      FOR v_email IN
        SELECT * FROM public.stage_automation_emails
        WHERE stage_automation_id = v_automation.id
        ORDER BY sequence_order ASC
      LOOP
        IF v_email.sequence_order = 1 THEN
          v_scheduled_time := now();
          IF v_email.delay_value IS NOT NULL THEN
            v_scheduled_time := now() + make_interval(
              days := CASE WHEN v_email.delay_unit = 'days' THEN v_email.delay_value ELSE 0 END,
              weeks := CASE WHEN v_email.delay_unit = 'weeks' THEN v_email.delay_value ELSE 0 END
            );
          END IF;
        ELSE
          SELECT scheduled_for INTO v_scheduled_time
          FROM public.automation_email_queue
          WHERE id = v_previous_queue_id;
          
          IF v_email.delay_value IS NOT NULL THEN
            v_scheduled_time := v_scheduled_time + make_interval(
              days := CASE WHEN v_email.delay_unit = 'days' THEN v_email.delay_value ELSE 0 END,
              weeks := CASE WHEN v_email.delay_unit = 'weeks' THEN v_email.delay_value ELSE 0 END
            );
          END IF;
        END IF;
        
        INSERT INTO public.automation_email_queue (
          stage_automation_email_id,
          job_candidate_association_id,
          scheduled_for,
          occurrence_number,
          parent_queue_id
        ) VALUES (
          v_email.id,
          NEW.id,
          v_scheduled_time,
          1,
          NULL
        ) RETURNING id INTO v_previous_queue_id;
        
        EXIT WHEN v_email.is_recurring;
      END LOOP;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER on_candidate_stage_change_automation
  AFTER UPDATE ON public.job_candidate_associations
  FOR EACH ROW
  WHEN (NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id)
  EXECUTE FUNCTION public.trigger_stage_automation();