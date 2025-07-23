
-- Fix workers table schema by recreating enums and adding missing columns
-- This migration will force a clean recreation of the enums and add all missing fields

-- First, let's drop the worker_type column entirely to allow enum recreation
ALTER TABLE public.workers DROP COLUMN IF EXISTS worker_type;

-- Drop the old enum types if they exist
DROP TYPE IF EXISTS worker_type_enum CASCADE;
DROP TYPE IF EXISTS contractor_payment_type_enum CASCADE;
DROP TYPE IF EXISTS payment_frequency_enum CASCADE;

-- Create the new enum types with correct values
CREATE TYPE worker_type_enum AS ENUM ('employee', 'contractor');
CREATE TYPE contractor_payment_type_enum AS ENUM ('fixed_rate', 'hourly_rate', 'per_project');
CREATE TYPE payment_frequency_enum AS ENUM ('bi_monthly', 'monthly', 'custom');

-- Recreate the worker_type column with the new enum and default value
ALTER TABLE public.workers 
ADD COLUMN worker_type worker_type_enum NOT NULL DEFAULT 'employee';

-- Add all missing contractor payment columns
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS contractor_payment_type contractor_payment_type_enum,
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS monthly_fixed_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS project_details TEXT;

-- Add all missing payment frequency columns
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS payment_frequency payment_frequency_enum DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS custom_pay_dates JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS next_payment_date DATE;

-- Add comments for all the new columns
COMMENT ON COLUMN public.workers.worker_type IS 'Type of worker: employee or contractor';
COMMENT ON COLUMN public.workers.contractor_payment_type IS 'Payment type for contractors: fixed_rate, hourly_rate, or per_project';
COMMENT ON COLUMN public.workers.hourly_rate IS 'Hourly rate for contractors paid by hour';
COMMENT ON COLUMN public.workers.monthly_fixed_amount IS 'Fixed monthly amount for contractors on fixed rate';
COMMENT ON COLUMN public.workers.project_details IS 'Details about project-based payment arrangements';
COMMENT ON COLUMN public.workers.payment_frequency IS 'How frequently the worker is paid';
COMMENT ON COLUMN public.workers.custom_pay_dates IS 'Custom payment dates when frequency is custom (array of day numbers)';
COMMENT ON COLUMN public.workers.next_payment_date IS 'Next scheduled payment date';

-- Update any existing worker records to have proper default values
UPDATE public.workers 
SET worker_type = 'employee' 
WHERE worker_type IS NULL;

-- Ensure existing nullable fields have proper defaults where needed
ALTER TABLE public.workers 
ALTER COLUMN worker_entity_type SET DEFAULT 'not_specified'::worker_entity_type_enum;

-- Make sure contract_status has a proper default
ALTER TABLE public.workers 
ALTER COLUMN contract_status SET DEFAULT 'pending'::contract_status_enum;
