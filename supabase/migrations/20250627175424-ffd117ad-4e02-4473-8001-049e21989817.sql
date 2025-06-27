
-- Create supported currencies table
CREATE TABLE public.supported_currencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert common currencies
INSERT INTO public.supported_currencies (code, name, symbol) VALUES
('USD', 'US Dollar', '$'),
('EUR', 'Euro', '€'),
('GBP', 'British Pound', '£'),
('CAD', 'Canadian Dollar', 'C$'),
('AUD', 'Australian Dollar', 'A$'),
('JPY', 'Japanese Yen', '¥'),
('CHF', 'Swiss Franc', 'CHF'),
('SEK', 'Swedish Krona', 'kr'),
('NOK', 'Norwegian Krone', 'kr'),
('DKK', 'Danish Krone', 'kr');

-- Create currency exchange rates table
CREATE TABLE public.currency_exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  target_currency TEXT NOT NULL,
  rate NUMERIC(15,8) NOT NULL,
  rate_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(base_currency, target_currency, rate_date)
);

-- Create currency conversions table for tracking invoice conversions
CREATE TABLE public.currency_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL,
  original_amount NUMERIC NOT NULL,
  original_currency TEXT NOT NULL,
  converted_amount NUMERIC NOT NULL,
  converted_currency TEXT NOT NULL,
  exchange_rate NUMERIC(15,8) NOT NULL,
  conversion_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE
);

-- Add default_currency to organizations
ALTER TABLE public.organizations 
ADD COLUMN default_currency TEXT DEFAULT 'USD';

-- Add default currency platform setting
INSERT INTO public.platform_settings (setting_key, display_name, setting_value, setting_type, description)
VALUES (
  'default_currency',
  'Default Platform Currency',
  'USD',
  'select',
  'Default currency for the platform'
);

-- Add exchange rate fields to invoices for historical tracking
ALTER TABLE public.invoices 
ADD COLUMN exchange_rate_used NUMERIC(15,8),
ADD COLUMN base_currency_amount NUMERIC,
ADD COLUMN conversion_date TIMESTAMP WITH TIME ZONE;

-- Enable RLS on new tables
ALTER TABLE public.supported_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_conversions ENABLE ROW LEVEL SECURITY;

-- Create policies for supported currencies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view supported currencies" 
  ON public.supported_currencies 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- Create policies for exchange rates (read-only for authenticated users)
CREATE POLICY "Authenticated users can view exchange rates" 
  ON public.currency_exchange_rates 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

-- Platform admins can manage exchange rates
CREATE POLICY "Platform admins can manage exchange rates" 
  ON public.currency_exchange_rates 
  FOR ALL 
  USING (get_user_type() = 'platform_admin');

-- Create policies for currency conversions
CREATE POLICY "Users can view conversions for their organization invoices" 
  ON public.currency_conversions 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i 
      WHERE i.id = currency_conversions.invoice_id 
      AND (
        get_user_type() = 'platform_admin' 
        OR i.organization_id = get_user_organization_id()
      )
    )
  );

CREATE POLICY "Platform admins can manage currency conversions" 
  ON public.currency_conversions 
  FOR ALL 
  USING (get_user_type() = 'platform_admin');

-- Add updated_at trigger for new tables
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.supported_currencies
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.currency_exchange_rates
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Create function to get latest exchange rate
CREATE OR REPLACE FUNCTION public.get_latest_exchange_rate(
  from_currency TEXT,
  to_currency TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  latest_rate NUMERIC;
BEGIN
  -- If same currency, return 1
  IF from_currency = to_currency THEN
    RETURN 1.0;
  END IF;
  
  -- Get the latest rate
  SELECT rate INTO latest_rate
  FROM public.currency_exchange_rates
  WHERE base_currency = from_currency 
    AND target_currency = to_currency
  ORDER BY rate_date DESC, created_at DESC
  LIMIT 1;
  
  -- If no direct rate found, try inverse
  IF latest_rate IS NULL THEN
    SELECT (1.0 / rate) INTO latest_rate
    FROM public.currency_exchange_rates
    WHERE base_currency = to_currency 
      AND target_currency = from_currency
    ORDER BY rate_date DESC, created_at DESC
    LIMIT 1;
  END IF;
  
  RETURN COALESCE(latest_rate, 1.0);
END;
$$;
