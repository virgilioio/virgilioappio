-- Make coresignal_id nullable since we migrated to Apollo
ALTER TABLE sourcing_preview_candidates 
ALTER COLUMN coresignal_id DROP NOT NULL;