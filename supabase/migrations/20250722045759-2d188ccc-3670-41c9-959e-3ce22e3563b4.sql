
-- Update the worker_type_enum to only have employee and contractor
DROP TYPE IF EXISTS worker_type_enum CASCADE;
CREATE TYPE worker_type_enum AS ENUM ('employee', 'contractor');

-- Create new contractor payment type enum
CREATE TYPE contractor_payment_type_enum AS ENUM ('fixed_rate', 'hourly_rate', 'per_project');

-- Add new columns to workers table for contractor payment details
ALTER TABLE public.workers 
ADD COLUMN contractor_payment_type contractor_payment_type_enum,
ADD COLUMN hourly_rate NUMERIC(10,2),
ADD COLUMN monthly_fixed_amount NUMERIC(10,2),
ADD COLUMN project_details TEXT;

-- Update the worker_type column to use the new enum
ALTER TABLE public.workers 
ALTER COLUMN worker_type TYPE worker_type_enum USING 
  CASE 
    WHEN worker_type::text IN ('full_time', 'part_time', 'intern', 'temporary') THEN 'employee'::worker_type_enum
    WHEN worker_type::text IN ('contractor', 'consultant') THEN 'contractor'::worker_type_enum
    ELSE 'employee'::worker_type_enum
  END;

-- Set default worker_type
ALTER TABLE public.workers 
ALTER COLUMN worker_type SET DEFAULT 'employee'::worker_type_enum;

-- Add comments for the new columns
COMMENT ON COLUMN public.workers.contractor_payment_type IS 'Payment type for contractors: fixed_rate, hourly_rate, or per_project';
COMMENT ON COLUMN public.workers.hourly_rate IS 'Hourly rate for contractors paid by hour';
COMMENT ON COLUMN public.workers.monthly_fixed_amount IS 'Fixed monthly amount for contractors on fixed rate';
COMMENT ON COLUMN public.workers.project_details IS 'Details about project-based payment arrangements';
