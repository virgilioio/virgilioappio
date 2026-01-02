-- Create trigger function for INSERT (when candidate first added to a stage)
CREATE OR REPLACE FUNCTION public.trigger_stage_automation_insert() 
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
  -- Only proceed if candidate has a stage assigned
  IF NEW.current_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find active on_stage_enter automations for this stage
  FOR v_automation IN
    SELECT * FROM public.stage_automations
    WHERE job_hiring_stage_id = NEW.current_stage_id
      AND trigger_event = 'on_stage_enter'
      AND is_active = true
  LOOP
    v_previous_queue_id := NULL;
    
    -- Queue each email in the automation sequence
    FOR v_email IN
      SELECT * FROM public.stage_automation_emails
      WHERE stage_automation_id = v_automation.id
      ORDER BY sequence_order ASC
    LOOP
      -- Calculate scheduled time based on delay
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
      
      -- For recurring emails, we only queue the first occurrence on insert
      EXIT WHEN v_email.is_recurring;
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for INSERT on job_candidate_associations
CREATE TRIGGER on_candidate_stage_enter_insert
  AFTER INSERT ON public.job_candidate_associations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_stage_automation_insert();