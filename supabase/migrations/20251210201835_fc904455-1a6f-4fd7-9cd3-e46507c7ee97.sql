-- Add has_location column to sourcing_preview_candidates table for Apollo availability flags
ALTER TABLE sourcing_preview_candidates 
ADD COLUMN IF NOT EXISTS has_location BOOLEAN DEFAULT false;

-- Add comment to clarify the column purpose
COMMENT ON COLUMN sourcing_preview_candidates.has_location IS 'Indicates if location data is available after Apollo enrichment (not the actual location value)';