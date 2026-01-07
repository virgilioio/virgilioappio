-- Add collected_at column to track when a candidate was revealed within a specific sourcing project
ALTER TABLE sourcing_preview_candidates 
ADD COLUMN collected_at timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN sourcing_preview_candidates.collected_at IS 
'Timestamp when this candidate was revealed/collected within this specific sourcing project';