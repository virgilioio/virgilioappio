ALTER TABLE public.members ADD COLUMN IF NOT EXISTS accepted_invite_token uuid;
CREATE INDEX IF NOT EXISTS members_accepted_invite_token_idx ON public.members (accepted_invite_token);

CREATE OR REPLACE FUNCTION public.invite_token_status(token_input uuid)
RETURNS TABLE(state text, invite_email text, organization_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN m.user_status = 'invited' AND m.user_id IS NULL
           AND (m.invite_expires_at IS NULL OR m.invite_expires_at > now()) THEN 'valid'
      WHEN m.user_status = 'invited' AND m.user_id IS NULL THEN 'expired'
      ELSE 'accepted'
    END::text,
    m.invited_email::text,
    o.name::text
  FROM public.members m
  LEFT JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.invite_token = token_input
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  SELECT 'accepted'::text, m.invited_email::text, o.name::text
  FROM public.members m
  LEFT JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.accepted_invite_token = token_input
  LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT 'unknown'::text, NULL::text, NULL::text;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.invite_token_status(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accept_invitation(token_input uuid, new_user_id uuid)
 RETURNS TABLE(success boolean, error_message text, member_id uuid, user_type text, member_role text, organization_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  member_record public.members%ROWTYPE;
  retry_count INTEGER := 0;
  max_retries INTEGER := 5;
  user_exists BOOLEAN := false;
  wait_seconds NUMERIC;
BEGIN
  RAISE LOG 'Accepting invitation for token: % by user: %', token_input, new_user_id;

  SELECT * INTO member_record
  FROM public.members
  WHERE invite_token = token_input
    AND user_status = 'invited'
    AND invite_expires_at > now()
    AND user_id IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE LOG 'Invalid invitation acceptance attempt for token: %', token_input;
    RETURN QUERY SELECT false, 'Invalid or expired invitation'::text, null::uuid, null::text, null::text, null::uuid;
    RETURN;
  END IF;

  WHILE retry_count < max_retries LOOP
    BEGIN
      SELECT EXISTS(
        SELECT 1 FROM auth.users WHERE id = new_user_id
      ) INTO user_exists;

      IF NOT user_exists THEN
        wait_seconds := 0.1 * POWER(2, retry_count);
        RAISE LOG 'User % not found in auth.users, waiting % seconds (attempt %/%)', new_user_id, wait_seconds, retry_count + 1, max_retries;
        PERFORM pg_sleep(wait_seconds);
        retry_count := retry_count + 1;
        CONTINUE;
      END IF;

      UPDATE public.members
      SET
        user_id = new_user_id,
        user_status = 'active',
        invite_token = NULL,
        accepted_invite_token = token_input,
        invite_expires_at = NULL,
        updated_at = now()
      WHERE id = member_record.id;

      RAISE LOG 'Successfully accepted invitation for member: % on attempt %', member_record.id, retry_count + 1;
      RETURN QUERY SELECT
        true,
        'Invitation accepted successfully'::text,
        member_record.id,
        member_record.user_type::text,
        member_record.system_role::text,
        member_record.organization_id;
      RETURN;

    EXCEPTION
      WHEN foreign_key_violation THEN
        retry_count := retry_count + 1;
        wait_seconds := 0.1 * POWER(2, retry_count - 1);

        RAISE LOG 'Foreign key constraint violation for user %, retrying in % seconds (attempt %/%)', new_user_id, wait_seconds, retry_count, max_retries;

        IF retry_count >= max_retries THEN
          RAISE LOG 'Max retries exceeded for invitation acceptance, user: %', new_user_id;
          RETURN QUERY SELECT false, 'User account not ready, please try again in a few seconds'::text, null::uuid, null::text, null::text, null::uuid;
          RETURN;
        END IF;

        PERFORM pg_sleep(wait_seconds);
    END;
  END LOOP;

  RETURN QUERY SELECT false, 'Unable to complete invitation acceptance after multiple attempts'::text, null::uuid, null::text, null::text, null::uuid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_pending_invitation(p_user_id uuid)
 RETURNS TABLE(success boolean, action_taken text, organization_id uuid, organization_name text, member_role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_email TEXT;
  v_member_record RECORD;
BEGIN
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_user_email IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'user_not_found'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  SELECT m.id, m.organization_id, m.system_role, m.invite_expires_at, m.invite_token, o.name as org_name
  INTO v_member_record
  FROM members m
  JOIN organizations o ON m.organization_id = o.id
  WHERE m.invited_email = v_user_email
    AND m.user_status = 'invited'
    AND m.user_id IS NULL
    AND (m.invite_expires_at IS NULL OR m.invite_expires_at > NOW())
  FOR UPDATE OF m
  LIMIT 1;

  IF v_member_record IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'no_pending_invitation'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  UPDATE members SET
    user_id = p_user_id,
    user_status = 'active',
    invite_token = NULL,
    accepted_invite_token = COALESCE(v_member_record.invite_token, accepted_invite_token),
    invite_expires_at = NULL,
    updated_at = NOW()
  WHERE id = v_member_record.id;

  RETURN QUERY SELECT
    true::BOOLEAN,
    'invitation_accepted'::TEXT,
    v_member_record.organization_id,
    v_member_record.org_name,
    v_member_record.system_role::text;
END;
$function$;