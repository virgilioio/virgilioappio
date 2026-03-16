
-- Create candidate_sources table
CREATE TABLE public.candidate_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'tenant',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.candidate_sources ENABLE ROW LEVEL SECURITY;

-- Read policy: authenticated users can see platform defaults + their tenant's sources
CREATE POLICY "Users can read platform and own tenant sources"
ON public.candidate_sources
FOR SELECT
TO authenticated
USING (
  tenant_id IS NULL
  OR tenant_id IN (
    SELECT m.tenant_id FROM public.members m
    WHERE m.user_id = auth.uid() AND m.user_status = 'active'
  )
);

-- Insert policy: users can create sources for their own tenant
CREATE POLICY "Users can create sources for their tenant"
ON public.candidate_sources
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IS NOT NULL
  AND tenant_id IN (
    SELECT m.tenant_id FROM public.members m
    WHERE m.user_id = auth.uid() AND m.user_status = 'active'
  )
);

-- Update policy: users can update their own tenant's sources
CREATE POLICY "Users can update their tenant sources"
ON public.candidate_sources
FOR UPDATE
TO authenticated
USING (
  tenant_id IS NOT NULL
  AND tenant_id IN (
    SELECT m.tenant_id FROM public.members m
    WHERE m.user_id = auth.uid() AND m.user_status = 'active'
  )
);

-- Delete policy: users can delete their own tenant's sources
CREATE POLICY "Users can delete their tenant sources"
ON public.candidate_sources
FOR DELETE
TO authenticated
USING (
  tenant_id IS NOT NULL
  AND tenant_id IN (
    SELECT m.tenant_id FROM public.members m
    WHERE m.user_id = auth.uid() AND m.user_status = 'active'
  )
);

-- Seed platform defaults
INSERT INTO public.candidate_sources (tenant_id, name, display_order, source) VALUES
  (NULL, 'LinkedIn', 0, 'platform'),
  (NULL, 'Referral', 1, 'platform'),
  (NULL, 'Job Board', 2, 'platform'),
  (NULL, 'Career Site', 3, 'platform'),
  (NULL, 'Agency', 4, 'platform'),
  (NULL, 'Direct Application', 5, 'platform'),
  (NULL, 'Sourcing', 6, 'platform'),
  (NULL, 'Other', 7, 'platform');

-- Index for tenant lookup
CREATE INDEX idx_candidate_sources_tenant_id ON public.candidate_sources(tenant_id);
