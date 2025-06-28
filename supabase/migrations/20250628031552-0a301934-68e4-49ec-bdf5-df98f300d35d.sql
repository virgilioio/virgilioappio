
-- Drop the existing view that uses SECURITY DEFINER
DROP VIEW IF EXISTS public.organization_exchange_rates;

-- Create a new view without SECURITY DEFINER dependency
CREATE VIEW public.organization_exchange_rates AS
SELECT 
  o.id as organization_id,
  o.name as organization_name,
  o.default_currency as base_currency,
  sc.code as target_currency,
  sc.name as target_currency_name,
  sc.symbol as target_currency_symbol,
  COALESCE(
    -- Try direct rate first
    (SELECT rate FROM public.currency_exchange_rates 
     WHERE base_currency = o.default_currency 
     AND target_currency = sc.code
     ORDER BY rate_date DESC, created_at DESC LIMIT 1),
    -- Try inverse rate
    (SELECT (1.0 / rate) FROM public.currency_exchange_rates 
     WHERE base_currency = sc.code 
     AND target_currency = o.default_currency
     ORDER BY rate_date DESC, created_at DESC LIMIT 1),
    -- Fallback to 1.0
    1.0
  ) as rate,
  COALESCE(
    (SELECT rate_date FROM public.currency_exchange_rates 
     WHERE (base_currency = o.default_currency AND target_currency = sc.code)
     OR (base_currency = sc.code AND target_currency = o.default_currency)
     ORDER BY rate_date DESC LIMIT 1),
    CURRENT_DATE
  ) as rate_date
FROM public.organizations o
CROSS JOIN public.supported_currencies sc
WHERE sc.is_active = true 
  AND sc.code != o.default_currency
  AND o.status = 'active';

-- Enable RLS on the view
ALTER VIEW public.organization_exchange_rates SET (security_barrier = true);

-- Create RLS policies for the view
-- Note: Views inherit RLS from their underlying tables, but we need explicit policies

-- Platform admins can see all organization exchange rates
CREATE POLICY "Platform admins can view all organization exchange rates"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (get_user_type() = 'platform_admin');

-- Organization owners can see their own organization's exchange rates
CREATE POLICY "Organization owners can view their exchange rates"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    get_user_type() = 'workspace_owner' 
    AND owner_id = auth.uid()
  );

-- Organization members can see their organization's exchange rates
CREATE POLICY "Organization members can view their org exchange rates"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = organizations.id 
      AND m.user_status = 'active'
    )
  );
