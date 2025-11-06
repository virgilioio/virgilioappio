-- Add additional preview fields to coresignal_preview_candidates table
ALTER TABLE public.coresignal_preview_candidates
ADD COLUMN IF NOT EXISTS industry text,
ADD COLUMN IF NOT EXISTS connections_count integer,
ADD COLUMN IF NOT EXISTS follower_count integer,
ADD COLUMN IF NOT EXISTS company_url text,
ADD COLUMN IF NOT EXISTS company_website text,
ADD COLUMN IF NOT EXISTS company_industry text,
ADD COLUMN IF NOT EXISTS experience_location text;