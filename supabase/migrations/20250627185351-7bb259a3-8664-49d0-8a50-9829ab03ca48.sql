
-- Create function to get organization's default currency
CREATE OR REPLACE FUNCTION public.get_organization_default_currency(org_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  default_curr text;
BEGIN
  SELECT default_currency INTO default_curr
  FROM public.organizations
  WHERE id = org_id;
  
  RETURN COALESCE(default_curr, 'USD');
END;
$$;

-- Create function for organization-aware currency conversion
CREATE OR REPLACE FUNCTION public.get_organization_currency_rate(
  from_currency text,
  to_currency text,
  org_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  org_base_currency text;
  direct_rate numeric;
  inverse_rate numeric;
  usd_to_from_rate numeric;
  usd_to_to_rate numeric;
BEGIN
  -- If same currency, return 1
  IF from_currency = to_currency THEN
    RETURN 1.0;
  END IF;
  
  -- Get organization's base currency if org_id provided
  IF org_id IS NOT NULL THEN
    org_base_currency := public.get_organization_default_currency(org_id);
  ELSE
    org_base_currency := 'USD';
  END IF;
  
  -- Try direct rate first
  SELECT rate INTO direct_rate
  FROM public.currency_exchange_rates
  WHERE base_currency = from_currency 
    AND target_currency = to_currency
  ORDER BY rate_date DESC, created_at DESC
  LIMIT 1;
  
  IF direct_rate IS NOT NULL THEN
    RETURN direct_rate;
  END IF;
  
  -- Try inverse rate
  SELECT (1.0 / rate) INTO inverse_rate
  FROM public.currency_exchange_rates
  WHERE base_currency = to_currency 
    AND target_currency = from_currency
  ORDER BY rate_date DESC, created_at DESC
  LIMIT 1;
  
  IF inverse_rate IS NOT NULL THEN
    RETURN inverse_rate;
  END IF;
  
  -- Try triangulation through USD if neither currency is USD
  IF from_currency != 'USD' AND to_currency != 'USD' THEN
    -- Get USD to from_currency rate
    SELECT rate INTO usd_to_from_rate
    FROM public.currency_exchange_rates
    WHERE base_currency = 'USD' AND target_currency = from_currency
    ORDER BY rate_date DESC, created_at DESC
    LIMIT 1;
    
    -- Get USD to to_currency rate  
    SELECT rate INTO usd_to_to_rate
    FROM public.currency_exchange_rates
    WHERE base_currency = 'USD' AND target_currency = to_currency
    ORDER BY rate_date DESC, created_at DESC
    LIMIT 1;
    
    -- Calculate cross rate: (USD/from) * (to/USD) = to/from
    IF usd_to_from_rate IS NOT NULL AND usd_to_to_rate IS NOT NULL THEN
      RETURN usd_to_to_rate / usd_to_from_rate;
    END IF;
  END IF;
  
  -- If organization has a non-USD base currency, try triangulation through org base
  IF org_base_currency != 'USD' AND org_base_currency != from_currency AND org_base_currency != to_currency THEN
    RETURN public.get_organization_currency_rate(from_currency, org_base_currency, NULL) * 
           public.get_organization_currency_rate(org_base_currency, to_currency, NULL);
  END IF;
  
  -- Fallback to 1.0
  RETURN 1.0;
END;
$$;

-- Create view for organization-specific exchange rates
CREATE OR REPLACE VIEW public.organization_exchange_rates AS
SELECT 
  o.id as organization_id,
  o.name as organization_name,
  o.default_currency as base_currency,
  sc.code as target_currency,
  sc.name as target_currency_name,
  sc.symbol as target_currency_symbol,
  public.get_organization_currency_rate(o.default_currency, sc.code, o.id) as rate,
  (SELECT rate_date FROM public.currency_exchange_rates 
   WHERE (base_currency = o.default_currency AND target_currency = sc.code)
   OR (base_currency = sc.code AND target_currency = o.default_currency)
   OR (base_currency = 'USD' AND target_currency IN (o.default_currency, sc.code))
   ORDER BY rate_date DESC LIMIT 1) as rate_date
FROM public.organizations o
CROSS JOIN public.supported_currencies sc
WHERE sc.is_active = true 
  AND sc.code != o.default_currency
  AND o.status = 'active';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_currency_rates_base_target_date 
ON public.currency_exchange_rates(base_currency, target_currency, rate_date DESC);

CREATE INDEX IF NOT EXISTS idx_organizations_default_currency 
ON public.organizations(default_currency) WHERE status = 'active';

-- Function to get all unique default currencies used by organizations
CREATE OR REPLACE FUNCTION public.get_active_organization_currencies()
RETURNS TABLE(currency_code text, organization_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT 
    default_currency as currency_code,
    COUNT(*) as organization_count
  FROM public.organizations 
  WHERE status = 'active' 
    AND default_currency IS NOT NULL
  GROUP BY default_currency
  ORDER BY organization_count DESC, default_currency;
$$;
