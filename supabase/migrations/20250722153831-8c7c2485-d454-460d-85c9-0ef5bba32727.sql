
-- Check if the migration has been applied and fix the workers table schema
-- This will ensure all contractor payment fields are properly added

-- First, let's safely add the contractor payment type enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contractor_payment_type_enum') THEN
        CREATE TYPE contractor_payment_type_enum AS ENUM ('fixed_rate', 'hourly_rate', 'per_project');
    END IF;
END $$;

-- Update the worker_type_enum to only have employee and contractor
DO $$
BEGIN
    -- Check if we need to update the enum
    IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'worker_type_enum' AND e.enumlabel IN ('full_time', 'part_time', 'intern', 'temporary', 'consultant')) THEN
        -- Drop and recreate the enum with proper values
        DROP TYPE IF EXISTS worker_type_enum CASCADE;
        CREATE TYPE worker_type_enum AS ENUM ('employee', 'contractor');
        
        -- Recreate the column with the new enum
        ALTER TABLE public.workers ALTER COLUMN worker_type DROP DEFAULT;
        ALTER TABLE public.workers ALTER COLUMN worker_type TYPE worker_type_enum USING 
          CASE 
            WHEN worker_type::text IN ('full_time', 'part_time', 'intern', 'temporary') THEN 'employee'::worker_type_enum
            WHEN worker_type::text IN ('contractor', 'consultant') THEN 'contractor'::worker_type_enum
            ELSE 'employee'::worker_type_enum
          END;
        ALTER TABLE public.workers ALTER COLUMN worker_type SET DEFAULT 'employee'::worker_type_enum;
    END IF;
END $$;

-- Add contractor payment columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'contractor_payment_type') THEN
        ALTER TABLE public.workers ADD COLUMN contractor_payment_type contractor_payment_type_enum;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'hourly_rate') THEN
        ALTER TABLE public.workers ADD COLUMN hourly_rate NUMERIC(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'monthly_fixed_amount') THEN
        ALTER TABLE public.workers ADD COLUMN monthly_fixed_amount NUMERIC(10,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'project_details') THEN
        ALTER TABLE public.workers ADD COLUMN project_details TEXT;
    END IF;
END $$;

-- Add comments for the new columns
COMMENT ON COLUMN public.workers.contractor_payment_type IS 'Payment type for contractors: fixed_rate, hourly_rate, or per_project';
COMMENT ON COLUMN public.workers.hourly_rate IS 'Hourly rate for contractors paid by hour';
COMMENT ON COLUMN public.workers.monthly_fixed_amount IS 'Fixed monthly amount for contractors on fixed rate';
COMMENT ON COLUMN public.workers.project_details IS 'Details about project-based payment arrangements';
