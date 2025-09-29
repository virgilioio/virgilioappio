-- Simple migration to add organization_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'candidates' AND column_name = 'organization_id') THEN
        ALTER TABLE public.candidates 
        ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
        
        CREATE INDEX idx_candidates_organization_id ON public.candidates(organization_id);
    END IF;
END $$;

-- Backfill organization_id for existing candidates
UPDATE public.candidates 
SET organization_id = (
  SELECT m.organization_id 
  FROM public.members m 
  WHERE m.user_id = candidates.created_by 
  LIMIT 1
)
WHERE organization_id IS NULL AND created_by IS NOT NULL;