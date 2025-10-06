-- Add SaaS Admin fields for trial and suspension management
-- Safe additions using IF NOT EXISTS

-- Trial end tracking
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;

-- Suspension audit fields
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- Helpful indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_organizations_trial_end 
  ON organizations(trial_end_date) WHERE trial_end_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_suspended 
  ON organizations(suspended_at) WHERE suspended_at IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN organizations.trial_end_date IS 'When the trial period ends (if status=trialing)';
COMMENT ON COLUMN organizations.suspended_at IS 'Timestamp when org was suspended';
COMMENT ON COLUMN organizations.suspended_reason IS 'Reason provided by admin for suspension';