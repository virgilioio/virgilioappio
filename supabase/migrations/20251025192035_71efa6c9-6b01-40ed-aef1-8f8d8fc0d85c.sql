-- Migration: Add custom_stage_name to job_hiring_stages
-- Phase 1: Stage Name Override Configuration

ALTER TABLE job_hiring_stages 
ADD COLUMN IF NOT EXISTS custom_stage_name TEXT NULL;

-- Add updated_at column with trigger for auto-update
ALTER TABLE job_hiring_stages 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_job_hiring_stages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO '';

-- Create trigger to auto-update updated_at on changes
DROP TRIGGER IF EXISTS job_hiring_stages_updated_at ON job_hiring_stages;
CREATE TRIGGER job_hiring_stages_updated_at
BEFORE UPDATE ON job_hiring_stages
FOR EACH ROW
EXECUTE FUNCTION update_job_hiring_stages_updated_at();