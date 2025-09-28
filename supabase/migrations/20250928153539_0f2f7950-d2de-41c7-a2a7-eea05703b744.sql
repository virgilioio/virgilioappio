-- Add SaaS management columns to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS plan_type text,
ADD COLUMN IF NOT EXISTS renewal_date date,
ADD COLUMN IF NOT EXISTS billing_id text;

-- Update status column if it doesn't already exist with proper default
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' 
                   AND column_name = 'status' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.organizations ADD COLUMN status text DEFAULT 'active';
    END IF;
END $$;