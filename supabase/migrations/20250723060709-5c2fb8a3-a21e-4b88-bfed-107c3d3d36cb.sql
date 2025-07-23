
-- Create enums for worker contracts
CREATE TYPE public.employment_type_enum AS ENUM (
  'full_time',
  'part_time',
  'temporary',
  'internship'
);

CREATE TYPE public.contractor_payment_type_enum AS ENUM (
  'fixed_rate',
  'hourly_rate',
  'per_project'
);

CREATE TYPE public.employment_term_enum AS ENUM (
  'indefinite',
  'definite'
);

CREATE TYPE public.seniority_level_enum AS ENUM (
  'entry',
  'junior',
  'mid',
  'senior',
  'lead',
  'principal',
  'director',
  'vp',
  'c_level'
);

CREATE TYPE public.payment_period_enum AS ENUM (
  'annual',
  'monthly',
  'semimonthly',
  'biweekly',
  'weekly',
  'daily',
  'hourly'
);

CREATE TYPE public.payment_frequency_enum AS ENUM (
  'bi_monthly',
  'monthly',
  'custom'
);

-- Update worker_type_enum to match expected values
DROP TYPE IF EXISTS public.worker_type_enum CASCADE;
CREATE TYPE public.worker_type_enum AS ENUM (
  'employee',
  'contractor'
);

-- Create worker_contracts table
CREATE TABLE public.worker_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL,
  worker_type worker_type_enum NOT NULL,
  job_title TEXT,
  seniority_level seniority_level_enum,
  contract_type contract_type_enum,
  employment_terms employment_type_enum,
  contract_status contract_status_enum DEFAULT 'pending',
  employment_term employment_term_enum DEFAULT 'indefinite',
  start_date DATE,
  end_date DATE,
  working_location TEXT,
  scope_of_work TEXT,
  currency TEXT DEFAULT 'USD',
  base_salary NUMERIC,
  payment_period payment_period_enum DEFAULT 'monthly',
  payment_frequency payment_frequency_enum DEFAULT 'monthly',
  custom_pay_dates INTEGER[],
  next_payment_date DATE,
  contractor_payment_type contractor_payment_type_enum,
  hourly_rate NUMERIC,
  monthly_fixed_amount NUMERIC,
  project_details TEXT,
  department TEXT,
  manager_id UUID REFERENCES public.workers(id),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for worker_contracts
ALTER TABLE public.worker_contracts ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all worker contracts
CREATE POLICY "Platform admins can manage all worker contracts" 
  ON public.worker_contracts 
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

-- Organization members can view contracts in their organization
CREATE POLICY "Organization members can view contracts in their org" 
  ON public.worker_contracts 
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = worker_contracts.organization_id 
      AND m.user_status = 'active'
    )
  );

-- Organization admins can manage contracts in their organization
CREATE POLICY "Organization admins can manage contracts in their org" 
  ON public.worker_contracts 
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = worker_contracts.organization_id 
      AND m.member_role IN ('admin', 'workspace_owner')
      AND m.user_status = 'active'
    )
  );

-- Add updated_at trigger
CREATE TRIGGER handle_worker_contracts_updated_at
  BEFORE UPDATE ON public.worker_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add indexes for better performance
CREATE INDEX idx_worker_contracts_worker_id ON public.worker_contracts(worker_id);
CREATE INDEX idx_worker_contracts_organization_id ON public.worker_contracts(organization_id);
CREATE INDEX idx_worker_contracts_is_active ON public.worker_contracts(is_active);
CREATE INDEX idx_worker_contracts_contract_status ON public.worker_contracts(contract_status);

-- Function to generate contract numbers
CREATE OR REPLACE FUNCTION generate_contract_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  contract_number TEXT;
BEGIN
  -- Get the next contract number for the organization
  SELECT COALESCE(MAX(CAST(SUBSTRING(contract_number FROM 2) AS INTEGER)), 0) + 1
  INTO next_number
  FROM worker_contracts
  WHERE organization_id = org_id;
  
  -- Format as C0001, C0002, etc.
  contract_number := 'C' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN contract_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate worker IDs
CREATE OR REPLACE FUNCTION generate_worker_id(org_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_id INTEGER;
BEGIN
  -- Get the next worker ID for the organization
  SELECT COALESCE(MAX(worker_id), 0) + 1
  INTO next_id
  FROM workers
  WHERE organization_id = org_id;
  
  RETURN next_id;
END;
$$ LANGUAGE plpgsql;
