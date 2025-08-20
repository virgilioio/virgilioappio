
-- 1) Keep invited_email when activating (don’t clear it)
CREATE OR REPLACE FUNCTION public.handle_member_invite()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  -- Auto-generate token for new invited members without user_id
  IF TG_OP = 'INSERT' AND NEW.user_status = 'invited' AND NEW.user_id IS NULL THEN
    NEW.invite_token := public.generate_invite_token();
    NEW.invite_expires_at := public.get_invite_expiry();
  END IF;

  -- When moving from invited -> active, clear token/expiry only (preserve invited_email for audit)
  IF TG_OP = 'UPDATE' AND OLD.user_status = 'invited' AND NEW.user_status = 'active' THEN
    NEW.invite_token := NULL;
    NEW.invite_expires_at := NULL;
    -- DO NOT clear NEW.invited_email
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Enforce “active requires user_id” for inserts and updates
CREATE OR REPLACE FUNCTION public.enforce_member_activation_with_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.user_status = 'active' AND NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot set status to active without a linked user_id';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_member_activation_with_user ON public.members;
CREATE TRIGGER trg_enforce_member_activation_with_user
  BEFORE INSERT OR UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_member_activation_with_user();

-- 3) Make get_member_display_info robust to missing profiles
CREATE OR REPLACE FUNCTION public.get_member_display_info(member_user_id uuid)
RETURNS TABLE(first_name text, last_name text, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only allow if current user is platform admin or in same org
  IF public.get_user_type_secure() = 'platform_admin'
     OR EXISTS (
       SELECT 1
       FROM public.members m1
       JOIN public.members m2 ON m1.organization_id = m2.organization_id
       WHERE m1.user_id = auth.uid()
         AND m2.user_id = member_user_id
     )
  THEN
    RETURN QUERY
    SELECT
      COALESCE(p.first_name, (au.raw_user_meta_data->>'first_name')),
      COALESCE(p.last_name,  (au.raw_user_meta_data->>'last_name')),
      COALESCE(p.email::text, au.email::text)
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    WHERE au.id = member_user_id;
  END IF;

  RETURN;
END;
$function$;

-- 4) One-off repair for Luna’s broken row (active with NULL user_id and no email)
-- Confirming known row: id = 05afbd8f-ca12-4607-a88a-1b7c6eb95f63 (Virgilio org)
UPDATE public.members
SET
  user_status       = 'invited',
  invited_email     = 'luna@virgilio.tech',
  invite_token      = COALESCE(invite_token, public.generate_invite_token()),
  invite_expires_at = COALESCE(invite_expires_at, public.get_invite_expiry()),
  updated_at        = now()
WHERE id = '05afbd8f-ca12-4607-a88a-1b7c6eb95f63'
  AND user_id IS NULL
  AND user_status = 'active';
