CREATE TABLE public.tenant_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid,
  expired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_access_grants_tenant ON public.tenant_access_grants(tenant_id);
CREATE INDEX idx_tenant_access_grants_active_expiry
  ON public.tenant_access_grants(ends_at)
  WHERE revoked_at IS NULL AND expired_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.tenant_access_grants TO authenticated;
GRANT ALL ON public.tenant_access_grants TO service_role;

ALTER TABLE public.tenant_access_grants ENABLE ROW LEVEL SECURITY;

-- Platform admins (members.user_type = 'platform_admin') can read and write.
CREATE POLICY "Platform admins can view grants"
  ON public.tenant_access_grants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE members.user_id = auth.uid()
        AND members.user_type = 'platform_admin'
        AND members.user_status = 'active'
    )
  );

CREATE POLICY "Platform admins can insert grants"
  ON public.tenant_access_grants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE members.user_id = auth.uid()
        AND members.user_type = 'platform_admin'
        AND members.user_status = 'active'
    )
  );

CREATE POLICY "Platform admins can update grants"
  ON public.tenant_access_grants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE members.user_id = auth.uid()
        AND members.user_type = 'platform_admin'
        AND members.user_status = 'active'
    )
  );

-- updated_at trigger
CREATE TRIGGER update_tenant_access_grants_updated_at
  BEFORE UPDATE ON public.tenant_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- One active grant per tenant: revoke any prior active grant on new insert.
CREATE OR REPLACE FUNCTION public.revoke_prior_active_grants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tenant_access_grants
     SET revoked_at = now(),
         revoked_by = NEW.granted_by,
         updated_at = now()
   WHERE tenant_id = NEW.tenant_id
     AND id <> NEW.id
     AND revoked_at IS NULL
     AND expired_at IS NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER revoke_prior_active_grants_trigger
  AFTER INSERT ON public.tenant_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.revoke_prior_active_grants();