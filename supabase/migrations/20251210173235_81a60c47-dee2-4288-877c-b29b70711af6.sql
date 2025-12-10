-- Phase 3: Database Migration for Apollo.io Integration
-- Step 3.1: Rename tables to be provider-agnostic

-- Rename coresignal_usage to sourcing_credits_usage
ALTER TABLE coresignal_usage RENAME TO sourcing_credits_usage;

-- Rename coresignal_preview_candidates to sourcing_preview_candidates
ALTER TABLE coresignal_preview_candidates RENAME TO sourcing_preview_candidates;

-- Step 3.2: Add Apollo-specific columns to candidates table
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS apollo_id text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS apollo_collected_at timestamptz;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS email_status text;

-- Add index for apollo_id lookups
CREATE INDEX IF NOT EXISTS idx_candidates_apollo_id ON candidates(apollo_id) WHERE apollo_id IS NOT NULL;

-- Step 3.3: Create backward-compatible views for any external dependencies
CREATE OR REPLACE VIEW coresignal_usage AS SELECT * FROM sourcing_credits_usage;
CREATE OR REPLACE VIEW coresignal_preview_candidates AS SELECT * FROM sourcing_preview_candidates;

-- Update foreign key reference comment (the FK itself will auto-update with table rename)
COMMENT ON TABLE sourcing_credits_usage IS 'Tracks sourcing credit usage per tenant (formerly coresignal_usage)';
COMMENT ON TABLE sourcing_preview_candidates IS 'Stores preview candidates from sourcing searches (formerly coresignal_preview_candidates)';