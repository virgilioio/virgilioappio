-- Create enums for worker-related fields
CREATE TYPE public.worker_status_enum AS ENUM (
  'active',
  'inactive', 
  'on_leave',
  'terminated',
  'pending'
);

CREATE TYPE public.worker_type_enum AS ENUM (
  'full_time',
  'part_time',
  'contractor',
  'intern',
  'consultant',
  'temporary'
);

CREATE TYPE public.contract_type_enum AS ENUM (
  'permanent',
  'temporary',
  'freelance',
  'fixed_term',
  'seasonal'
);

CREATE TYPE public.contract_status_enum AS ENUM (
  'active',
  'pending',
  'expired',
  'terminated',
  'suspended'
);

CREATE TYPE public.worker_entity_type_enum AS ENUM (
  'business_entity',
  'individual',
  'not_specified'
);

-- Create the workers table
CREATE TABLE public.workers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  personal_email TEXT,
  work_email TEXT,
  personal_phone TEXT,
  worker_status worker_status_enum NOT NULL DEFAULT 'pending',
  worker_type worker_type_enum NOT NULL,
  job_title TEXT,
  contract_type contract_type_enum,
  contract_status contract_status_enum DEFAULT 'pending',
  country TEXT,
  currency TEXT DEFAULT 'USD',
  entity TEXT,
  events JSONB DEFAULT '{}',
  manager_id UUID REFERENCES public.workers(id),
  state_province TEXT,
  worker_entity_type worker_entity_type_enum DEFAULT 'not_specified',
  start_date DATE,
  end_date DATE,
  pay_date DATE,
  department TEXT,
  roles_department TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all workers
CREATE POLICY "Platform admins can manage all workers" 
  ON public.workers 
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

-- Organization members can view workers in their organization
CREATE POLICY "Organization members can view workers in their org" 
  ON public.workers 
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = workers.organization_id 
      AND m.user_status = 'active'
    )
  );

-- Organization admins and workspace owners can manage workers in their organization
CREATE POLICY "Organization admins can manage workers in their org" 
  ON public.workers 
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = workers.organization_id 
      AND m.member_role IN ('admin', 'workspace_owner')
      AND m.user_status = 'active'
    )
  );

-- Organization admins can create workers in their organization
CREATE POLICY "Organization admins can create workers" 
  ON public.workers 
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = workers.organization_id 
      AND m.member_role IN ('admin', 'workspace_owner')
      AND m.user_status = 'active'
    )
  );

-- Add updated_at trigger
CREATE TRIGGER handle_workers_updated_at
  BEFORE UPDATE ON public.workers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add indexes for better performance
CREATE INDEX idx_workers_organization_id ON public.workers(organization_id);
CREATE INDEX idx_workers_worker_status ON public.workers(worker_status);
CREATE INDEX idx_workers_worker_type ON public.workers(worker_type);
CREATE INDEX idx_workers_country ON public.workers(country);
CREATE INDEX idx_workers_full_name ON public.workers(full_name);