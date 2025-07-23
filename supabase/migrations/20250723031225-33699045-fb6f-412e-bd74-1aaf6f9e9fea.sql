
-- Add employment_term enum for employees
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_term_enum') THEN
        CREATE TYPE employment_term_enum AS ENUM ('full_time', 'part_time', 'temporary', 'internship');
    END IF;
END $$;

-- Add employment_term column to workers table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workers' AND column_name = 'employment_term') THEN
        ALTER TABLE public.workers ADD COLUMN employment_term employment_term_enum;
    END IF;
END $$;

-- Update contract_type enum to have clearer values
DO $$
BEGIN
    -- Check if we need to update the contract_type enum
    IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'contract_type_enum' AND e.enumlabel IN ('seasonal', 'fixed_term')) THEN
        -- Drop and recreate the enum with proper values
        DROP TYPE IF EXISTS contract_type_enum CASCADE;
        CREATE TYPE contract_type_enum AS ENUM ('permanent', 'temporary', 'freelance');
        
        -- Recreate the column with the new enum
        ALTER TABLE public.workers ALTER COLUMN contract_type DROP DEFAULT;
        ALTER TABLE public.workers ALTER COLUMN contract_type TYPE contract_type_enum USING 
          CASE 
            WHEN contract_type::text IN ('permanent', 'fixed_term') THEN 'permanent'::contract_type_enum
            WHEN contract_type::text = 'temporary' THEN 'temporary'::contract_type_enum
            WHEN contract_type::text IN ('freelance', 'seasonal') THEN 'freelance'::contract_type_enum
            ELSE 'permanent'::contract_type_enum
          END;
        ALTER TABLE public.workers ALTER COLUMN contract_type SET DEFAULT 'permanent'::contract_type_enum;
    END IF;
END $$;

-- Add comments for the new column
COMMENT ON COLUMN public.workers.employment_term IS 'Employment term for employees: full_time, part_time, temporary, or internship';
