-- Create new RPC function that accepts user_id explicitly
CREATE OR REPLACE FUNCTION public.get_tenant_id_for_user(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  result uuid;
BEGIN
  -- Get tenant_id from the user's active membership
  SELECT o.tenant_id
    INTO result
  FROM public.members m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.user_id = p_user_id
    AND m.user_status = 'active'
  ORDER BY m.created_at NULLS LAST, m.id
  LIMIT 1;

  RETURN result;
END;
$function$;