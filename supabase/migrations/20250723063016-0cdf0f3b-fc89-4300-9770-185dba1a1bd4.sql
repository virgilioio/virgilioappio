
-- Add all missing columns to worker_contracts table
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS contract_number TEXT NOT NULL;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS worker_type worker_type_enum NOT NULL;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS seniority_level seniority_level_enum;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS contract_type contract_type_enum;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS employment_terms employment_type_enum;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS contract_status contract_status_enum DEFAULT 'pending';
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS employment_term employment_term_enum DEFAULT 'indefinite';
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS working_location TEXT;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS scope_of_work TEXT;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS base_salary NUMERIC;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS payment_period payment_period_enum DEFAULT 'monthly';
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS payment_frequency payment_frequency_enum DEFAULT 'monthly';
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS custom_pay_dates INTEGER[];
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS next_payment_date DATE;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS contractor_payment_type contractor_payment_type_enum;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS monthly_fixed_amount NUMERIC;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS project_details TEXT;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.workers(id);
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.worker_contracts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Create unique constraint to ensure only one active contract per worker
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_contracts_unique_active 
ON public.worker_contracts(worker_id) 
WHERE is_active = true;

-- Create unique constraint for contract numbers per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_contracts_unique_number 
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
CREATE INDEX IF NOT EXISTS idx_worker_contracts_worker_id ON public.worker_contracts(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_contracts_organization_id ON public.worker_contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_worker_contracts_contract_status ON public.worker_contracts(contract_status);
CREATE INDEX IF NOT EXISTS idx_worker_contracts_is_active ON public.worker_contracts(is_active);
CREATE INDEX IF NOT EXISTS idx_worker_contracts_manager_id ON public.worker_contracts(manager_id);

-- Migrate contract-related data from workers to worker_contracts
INSERT INTO public.worker_contracts (
  worker_id,
  organization_id,
  contract_number,
  worker_type,
  job_title,
  seniority_level,
  contract_type,
  employment_terms,
  contract_status,
  employment_term,
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
  COALESCE(w.contract_number, 'C' || LPAD(ROW_NUMBER() OVER (PARTITION BY w.organization_id ORDER BY w.created_at)::TEXT, 4, '0')) as contract_number,
  COALESCE(w.worker_type, 'employee') as worker_type,
  w.job_title,
  w.seniority_level,
  w.contract_type,
  w.employment_terms,
  COALESCE(w.contract_status, 'active') as contract_status,
  w.employment_term,
  w.start_date,
  w.end_date,
  w.working_location,
  w.scope_of_work,
  COALESCE(w.currency, 'USD') as currency,
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
FROM public.workers w
WHERE NOT EXISTS (
  SELECT 1 FROM public.worker_contracts wc 
  WHERE wc.worker_id = w.id
);

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
