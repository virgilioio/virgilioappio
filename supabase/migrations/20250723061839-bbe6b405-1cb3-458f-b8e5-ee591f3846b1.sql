
-- Apply the existing worker_contracts migration
-- This migration separates worker and contract data into two tables

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

-- Create unique constraint to ensure only one active contract per worker
CREATE UNIQUE INDEX idx_worker_contracts_unique_active 
ON public.worker_contracts(worker_id) 
WHERE is_active = true;

-- Create unique constraint for contract numbers per organization
CREATE UNIQUE INDEX idx_worker_contracts_unique_number 
ON public.worker_contracts(organization_id, contract_number);

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
      AND m.member_role = 'admin'
      AND m.user_status = 'active'
    )
  );

-- Organization admins can create contracts in their organization
CREATE POLICY "Organization admins can create contracts" 
  ON public.worker_contracts 
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = worker_contracts.organization_id 
      AND m.member_role = 'admin'
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
CREATE INDEX idx_worker_contracts_contract_status ON public.worker_contracts(contract_status);
CREATE INDEX idx_worker_contracts_is_active ON public.worker_contracts(is_active);
CREATE INDEX idx_worker_contracts_manager_id ON public.worker_contracts(manager_id);

-- Create function to generate contract numbers
CREATE OR REPLACE FUNCTION generate_contract_number(org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_number INTEGER;
    contract_number TEXT;
BEGIN
    -- Get the next contract number for this organization
    SELECT COALESCE(MAX(CAST(SUBSTRING(contract_number FROM '^C(\d+)$') AS INTEGER)), 0) + 1 
    INTO next_number 
    FROM public.worker_contracts 
    WHERE organization_id = org_id 
    AND contract_number ~ '^C\d+$';
    
    contract_number := 'C' || LPAD(next_number::TEXT, 4, '0');
    
    RETURN contract_number;
END;
$$;

-- Create trigger function to auto-assign contract number
CREATE OR REPLACE FUNCTION assign_contract_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only assign contract_number if it's not already set
    IF NEW.contract_number IS NULL OR NEW.contract_number = '' THEN
        NEW.contract_number = generate_contract_number(NEW.organization_id);
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger to auto-assign contract number on insert
CREATE TRIGGER trigger_assign_contract_number
    BEFORE INSERT ON public.worker_contracts
    FOR EACH ROW
    EXECUTE FUNCTION assign_contract_number();
