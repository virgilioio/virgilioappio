
-- Verify all columns exist in the workers table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'workers' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check all enum types exist with correct values
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE t.typname IN ('worker_type_enum', 'contractor_payment_type_enum', 'payment_frequency_enum')
ORDER BY t.typname, e.enumsortorder;

-- Clean up any conflicting fields and ensure proper defaults
-- Remove the old pay_date field if it exists
ALTER TABLE public.workers DROP COLUMN IF EXISTS pay_date;

-- Ensure all enum columns have proper defaults
ALTER TABLE public.workers 
ALTER COLUMN worker_type SET DEFAULT 'employee'::worker_type_enum;

ALTER TABLE public.workers 
ALTER COLUMN payment_frequency SET DEFAULT 'monthly'::payment_frequency_enum;

-- Add trigger to auto-assign worker_id if not exists
CREATE OR REPLACE FUNCTION public.assign_worker_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Only assign worker_id if it's not already set
    IF NEW.worker_id IS NULL THEN
        NEW.worker_id = generate_worker_id(NEW.organization_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-assigning worker_id
DROP TRIGGER IF EXISTS assign_worker_id_trigger ON public.workers;
CREATE TRIGGER assign_worker_id_trigger
    BEFORE INSERT ON public.workers
    FOR EACH ROW
    EXECUTE FUNCTION assign_worker_id();
