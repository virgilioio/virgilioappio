-- Drop and recreate worker_contracts table with all required columns
DROP TABLE IF EXISTS public.worker_contracts CASCADE;

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
  employment_term employment_duration_enum DEFAULT 'indefinite',
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

-- Create unique constraints
CREATE UNIQUE INDEX idx_worker_contracts_unique_active ON public.worker_contracts(worker_id) WHERE is_active = true;
CREATE UNIQUE INDEX idx_worker_contracts_unique_number ON public.worker_contracts(organization_id, contract_number);

-- Enable RLS
ALTER TABLE public.worker_contracts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Platform admins can manage all worker contracts" 
  ON public.worker_contracts 
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

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

-- Add updated_at trigger
CREATE TRIGGER handle_worker_contracts_updated_at
  BEFORE UPDATE ON public.worker_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add indexes
CREATE INDEX idx_worker_contracts_worker_id ON public.worker_contracts(worker_id);
CREATE INDEX idx_worker_contracts_organization_id ON public.worker_contracts(organization_id);
CREATE INDEX idx_worker_contracts_contract_status ON public.worker_contracts(contract_status);
CREATE INDEX idx_worker_contracts_is_active ON public.worker_contracts(is_active);
CREATE INDEX idx_worker_contracts_manager_id ON public.worker_contracts(manager_id);

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

-- Function to assign contract number
CREATE OR REPLACE FUNCTION assign_contract_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contract_number IS NULL OR NEW.contract_number = '' THEN
    NEW.contract_number = generate_contract_number(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to assign contract number
CREATE TRIGGER trigger_assign_contract_number
  BEFORE INSERT ON public.worker_contracts
  FOR EACH ROW
  EXECUTE FUNCTION assign_contract_number();

-- Migrate data from workers table
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
  generate_contract_number(w.organization_id) as contract_number,
  COALESCE(w.worker_type, 'employee'::worker_type_enum) as worker_type,
  w.job_title,
  w.seniority_level,
  w.contract_type,
  w.employment_terms,
  COALESCE(w.contract_status, 'active'::contract_status_enum) as contract_status,
  COALESCE(w.employment_term, 'indefinite'::employment_duration_enum) as employment_term,
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
FROM public.workers w;