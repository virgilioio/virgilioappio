-- Create table for caching CoreSignal salary data
CREATE TABLE public.salary_market_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_title TEXT NOT NULL,
  location_country TEXT NOT NULL,
  location_city TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  salary_min NUMERIC,
  salary_max NUMERIC,
  salary_median NUMERIC,
  percentile_25 NUMERIC,
  percentile_75 NUMERIC,
  percentile_90 NUMERIC,
  sample_size INTEGER,
  experience_level TEXT,
  data_source TEXT NOT NULL DEFAULT 'coresignal',
  market_competitiveness TEXT, -- 'low', 'moderate', 'high', 'very_high'
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_salary_market_data_lookup ON public.salary_market_data(job_title, location_country, location_city);
CREATE INDEX idx_salary_market_data_expires ON public.salary_market_data(expires_at);

-- Enable RLS
ALTER TABLE public.salary_market_data ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view salary market data" 
ON public.salary_market_data 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Platform admins can manage salary market data" 
ON public.salary_market_data 
FOR ALL 
USING (get_user_type_secure() = 'platform_admin');

-- Function to clean up expired salary data
CREATE OR REPLACE FUNCTION public.cleanup_expired_salary_data()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleanup_count INTEGER;
BEGIN
  DELETE FROM public.salary_market_data 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  RAISE LOG 'Cleaned up % expired salary market data records', cleanup_count;
  RETURN cleanup_count;
END;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_salary_market_data_updated_at
BEFORE UPDATE ON public.salary_market_data
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();