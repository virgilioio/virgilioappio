-- Fix the FK constraint to add ON DELETE CASCADE
ALTER TABLE public.scheduled_bookings 
  DROP CONSTRAINT IF EXISTS scheduled_bookings_candidate_id_fkey;

ALTER TABLE public.scheduled_bookings 
  ADD CONSTRAINT scheduled_bookings_candidate_id_fkey 
    FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;

-- Update admin_delete_candidate to explicitly handle scheduled_bookings before deletion
CREATE OR REPLACE FUNCTION public.admin_delete_candidate(p_candidate_id UUID) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'audit'
AS $$
DECLARE
  v_candidate_name text;
  v_tenant_id uuid;
  v_affected_count integer;
  v_booking_count integer;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform admins can delete candidates via this function';
  END IF;
  
  SELECT candidate_name, tenant_id INTO v_candidate_name, v_tenant_id
  FROM public.candidates
  WHERE id = p_candidate_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found: %', p_candidate_id;
  END IF;
  
  SELECT COUNT(*) INTO v_affected_count
  FROM public.job_candidate_associations
  WHERE candidate_id = p_candidate_id;

  SELECT COUNT(*) INTO v_booking_count
  FROM public.scheduled_bookings
  WHERE candidate_id = p_candidate_id;
  
  DELETE FROM public.scheduled_bookings WHERE candidate_id = p_candidate_id;
  DELETE FROM public.candidates WHERE id = p_candidate_id;
  
  PERFORM public.log_audit_event(
    p_action := 'admin_delete_candidate',
    p_table_name := 'candidates',
    p_record_id := p_candidate_id,
    p_user_id := auth.uid(),
    p_old_values := jsonb_build_object(
      'candidate_name', v_candidate_name,
      'tenant_id', v_tenant_id
    ),
    p_new_values := NULL
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'candidate_id', p_candidate_id,
    'candidate_name', v_candidate_name,
    'affected_associations', v_affected_count,
    'cancelled_bookings', v_booking_count,
    'message', format('Candidate "%s" deleted successfully', v_candidate_name)
  );
END;
$$;