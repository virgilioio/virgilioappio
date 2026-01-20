-- Add offer tracking columns to job_candidate_associations
ALTER TABLE job_candidate_associations
ADD COLUMN offered_at TIMESTAMPTZ,
ADD COLUMN offered_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN job_candidate_associations.offered_at IS 'Timestamp when candidate was moved to offer status';
COMMENT ON COLUMN job_candidate_associations.offered_by IS 'User who moved candidate to offer status';