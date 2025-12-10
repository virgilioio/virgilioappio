-- Add missing columns to existing sourcing_preview_candidates table
ALTER TABLE public.sourcing_preview_candidates
ADD COLUMN IF NOT EXISTS apollo_id TEXT,
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name_obfuscated TEXT,
ADD COLUMN IF NOT EXISTS has_email BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_phone BOOLEAN DEFAULT false;

-- Create index on apollo_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_sourcing_preview_apollo_id ON public.sourcing_preview_candidates(apollo_id);

-- Drop old view if exists
DROP VIEW IF EXISTS public.coresignal_preview_candidates;

-- Add sourcing cache columns to sourcing_projects if not exists
ALTER TABLE public.sourcing_projects
ADD COLUMN IF NOT EXISTS sourcing_cache_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sourcing_candidate_count INTEGER DEFAULT 0;