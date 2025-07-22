
-- First, let's add the missing columns that we're sending but don't exist in the workers table
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS custom_pay_dates JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS next_payment_date DATE;

-- Create enum for payment frequency if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_frequency_enum') THEN
        CREATE TYPE payment_frequency_enum AS ENUM ('bi_monthly', 'monthly', 'custom');
    END IF;
END $$;

-- Update the payment_frequency column to use the enum
ALTER TABLE public.workers 
ALTER COLUMN payment_frequency TYPE payment_frequency_enum USING payment_frequency::payment_frequency_enum;

-- Set default for payment_frequency
ALTER TABLE public.workers 
ALTER COLUMN payment_frequency SET DEFAULT 'monthly'::payment_frequency_enum;

-- Add comments for the new columns
COMMENT ON COLUMN public.workers.payment_frequency IS 'How frequently the worker is paid';
COMMENT ON COLUMN public.workers.custom_pay_dates IS 'Custom payment dates when frequency is custom (array of day numbers)';
COMMENT ON COLUMN public.workers.next_payment_date IS 'Next scheduled payment date';

-- Ensure existing nullable fields have proper defaults where needed
ALTER TABLE public.workers 
ALTER COLUMN worker_entity_type SET DEFAULT 'not_specified'::worker_entity_type_enum;

-- Make sure contract_status has a proper default
ALTER TABLE public.workers 
ALTER COLUMN contract_status SET DEFAULT 'pending'::contract_status_enum;
