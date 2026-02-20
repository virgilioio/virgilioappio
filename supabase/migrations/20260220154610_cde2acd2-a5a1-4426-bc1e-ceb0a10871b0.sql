
CREATE OR REPLACE FUNCTION public.log_candidate_created()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Resolve user_id: prefer created_by, fall back to JWT sub
  v_user_id := COALESCE(NEW.created_by, auth.uid());

  -- Guard: skip activity logging when there is no authenticated user
  -- (e.g. service-role inserts from public job applications)
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.log_activity(
    p_user_id := v_user_id,
    p_organization_id := NEW.organization_id,
    p_activity_type := 'candidate_created',
    p_title := 'Candidate added',
    p_description := 'Added ' || NEW.candidate_name || ' to the system',
    p_metadata := jsonb_build_object(
      'candidate_name', NEW.candidate_name,
      'email', NEW.email,
      'source', NEW.source,
      'candidate_id', NEW.id
    ),
    p_entity_type := 'candidate',
    p_entity_id := NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
