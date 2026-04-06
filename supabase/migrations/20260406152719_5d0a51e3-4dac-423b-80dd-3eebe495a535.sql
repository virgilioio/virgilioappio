CREATE OR REPLACE FUNCTION public.admin_manage_member(p_member_id uuid, p_changes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'audit'
AS $function$
DECLARE v_old_values jsonb; v_user_email text; v_operation text; v_member_tenant uuid;
BEGIN
  -- Get the member's tenant
  SELECT tenant_id INTO v_member_tenant FROM public.members WHERE id = p_member_id;

  -- Allow platform admins OR workspace owners in the same tenant
  IF NOT public.is_platform_admin() 
     AND NOT public.user_is_workspace_owner_in_tenant(v_member_tenant) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT to_jsonb(m.*) INTO v_old_values FROM public.members m WHERE id = p_member_id;
  IF v_old_values IS NULL THEN RAISE EXCEPTION 'Member not found: %', p_member_id; END IF;
  v_user_email := v_old_values->>'user_email';
  IF p_changes ? '_delete' AND (p_changes->>'_delete')::boolean = true THEN
    v_operation := 'delete'; DELETE FROM public.members WHERE id = p_member_id;
  ELSE
    v_operation := 'update';
    UPDATE public.members SET
      user_type = COALESCE((p_changes->>'user_type')::public.user_type_enum, user_type),
      system_role = COALESCE((p_changes->>'system_role')::public.system_role, system_role),
      user_status = COALESCE(p_changes->>'user_status', user_status),
      updated_at = now()
    WHERE id = p_member_id;
  END IF;
  PERFORM public.log_audit_event(p_action := format('admin_%s_member', v_operation), p_table_name := 'members', p_record_id := p_member_id, p_user_id := auth.uid(), p_old_values := v_old_values, p_new_values := CASE WHEN v_operation = 'delete' THEN NULL ELSE p_changes END);
  RETURN jsonb_build_object('success', true, 'member_id', p_member_id, 'operation', v_operation, 'user_email', v_user_email, 'message', format('Member "%s" %sd successfully', v_user_email, v_operation));
END;
$function$;