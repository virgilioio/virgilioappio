-- Add status and archived_at columns to sourcing_preview_candidates
ALTER TABLE sourcing_preview_candidates 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Add index for efficient filtering by status
CREATE INDEX IF NOT EXISTS idx_sourcing_preview_candidates_status 
ON sourcing_preview_candidates(sourcing_project_id, status);