
-- Create worker_contracts table with contract-specific fields
CREATE TABLE public.worker_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL,
  job_title TEXT,
  worker_type worker_type_enum NOT NULL DEFAULT 'employee',
  contract_type contract_type_enum DEFAULT 'permanent',
  contract_status contract_status_enum DEFAULT 'pending',
  employment_terms employment_terms_enum,
  employment_term employment_duration_enum,
  seniority_level seniority_level_enum,
  start_date DATE,
  end_date DATE,
  working_location TEXT,
  scope_of_work TEXT,
  currency TEXT DEFAULT 'USD',
  base_salary NUMERIC(12,2),
  payment_period payment_period_enum DEFAULT 'monthly',
  payment_frequency payment_frequency_enum DEFAULT 'monthly',
  custom_pay_dates JSONB DEFAULT '[]'::jsonb,
  next_payment_date DATE,
  contractor_payment_type contractor_payment_type_enum,
  hourly_rate NUMERIC(10,2),
  monthly_fixed_amount NUMERIC(10,2),
  project_details TEXT,
  department TEXT,
  manager_id UUID REFERENCES public.workers(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
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

-- Migrate existing data from workers to worker_contracts
INSERT INTO public.worker_contracts (
    worker_id,
    organization_id,
    contract_number,
    job_title,
    worker_type,
    contract_type,
    contract_status,
    employment_terms,
    employment_term,
    seniority_level,
    start_date,
    end_date,
    working_location,
    scope_of_work,
    currency,
    base_salary,
    payment_period,
    payment_frequency,
    custom_pay_dates,
    next_payment_date,
    contractor_payment_type,
    hourly_rate,
    monthly_fixed_amount,
    project_details,
    department,
    manager_id,
    is_active,
    created_by,
    created_at,
    updated_at
)
SELECT 
    w.id as worker_id,
    w.organization_id,
    generate_contract_number(w.organization_id) as contract_number,
    w.job_title,
    w.worker_type,
    w.contract_type,
    w.contract_status,
    w.employment_terms,
    w.employment_term,
    w.seniority_level,
    w.start_date,
    w.end_date,
    w.working_location,
    w.scope_of_work,
    w.currency,
    w.base_salary,
    w.payment_period,
    w.payment_frequency,
    w.custom_pay_dates,
    w.next_payment_date,
    w.contractor_payment_type,
    w.hourly_rate,
    w.monthly_fixed_amount,
    w.project_details,
    w.department,
    w.manager_id,
    true as is_active,
    w.created_by,
    w.created_at,
    w.updated_at
FROM public.workers w;

-- Now remove contract-specific columns from workers table
ALTER TABLE public.workers 
DROP COLUMN IF EXISTS job_title,
DROP COLUMN IF EXISTS worker_type,
DROP COLUMN IF EXISTS contract_type,
DROP COLUMN IF EXISTS contract_status,
DROP COLUMN IF EXISTS employment_terms,
DROP COLUMN IF EXISTS employment_term,
DROP COLUMN IF EXISTS seniority_level,
DROP COLUMN IF EXISTS start_date,
DROP COLUMN IF EXISTS end_date,
DROP COLUMN IF EXISTS working_location,
DROP COLUMN IF EXISTS scope_of_work,
DROP COLUMN IF EXISTS currency,
DROP COLUMN IF EXISTS base_salary,
DROP COLUMN IF EXISTS payment_period,
DROP COLUMN IF EXISTS payment_frequency,
DROP COLUMN IF EXISTS custom_pay_dates,
DROP COLUMN IF EXISTS next_payment_date,
DROP COLUMN IF EXISTS contractor_payment_type,
DROP COLUMN IF EXISTS hourly_rate,
DROP COLUMN IF EXISTS monthly_fixed_amount,
DROP COLUMN IF EXISTS project_details,
DROP COLUMN IF EXISTS department,
DROP COLUMN IF EXISTS manager_id;

-- Add comment to document the separation
COMMENT ON TABLE public.workers IS 'Core worker identity and personal information';
COMMENT ON TABLE public.worker_contracts IS 'Contract-specific information for workers, including job details, compensation, and organizational relationships';
