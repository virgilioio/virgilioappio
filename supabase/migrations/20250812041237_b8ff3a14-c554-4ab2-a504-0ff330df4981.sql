
DO $$
DECLARE
  v_id uuid;
BEGIN
  -- Locate the Virgilio organization (case-insensitive match by name).
  SELECT id INTO v_id
  FROM public.organizations
  WHERE lower(name) = 'virgilio'
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Virgilio organization not found. Please create an organization named "Virgilio" first.';
  END IF;

  -- Ensure Virgilio is the tenant: org_kind=tenant, tenant_id=self, no parent.
  UPDATE public.organizations
  SET
    org_kind = 'tenant'::public.org_kind_enum,
    tenant_id = id,
    parent_organization_id = NULL,
    updated_at = now()
  WHERE id = v_id;

  -- Set all other organizations as clients of Virgilio and assign the tenant_id.
  UPDATE public.organizations
  SET
    org_kind = 'client'::public.org_kind_enum,
    tenant_id = v_id,
    parent_organization_id = COALESCE(parent_organization_id, v_id),
    updated_at = now()
  WHERE id <> v_id;

  -- Ensure a tenant_subscriptions row exists for Virgilio.
  INSERT INTO public.tenant_subscriptions (tenant_id, subscribed, seat_quantity)
  VALUES (v_id, false, 0)
  ON CONFLICT (tenant_id) DO NOTHING;
END
$$;
