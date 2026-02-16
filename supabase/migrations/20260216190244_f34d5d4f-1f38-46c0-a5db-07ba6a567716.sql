
-- Add 'salary' to the field_type enum
ALTER TYPE public.field_type ADD VALUE IF NOT EXISTS 'salary';

-- Add field_config JSONB column to job_posting_application_fields
ALTER TABLE public.job_posting_application_fields
ADD COLUMN IF NOT EXISTS field_config JSONB DEFAULT NULL;
