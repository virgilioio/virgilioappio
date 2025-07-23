-- Clean up workers table by removing contract-related columns
-- These should only exist in the worker_contracts table

-- Remove contract-specific columns from workers table
ALTER TABLE public.workers 
DROP COLUMN IF EXISTS contract_type,
DROP COLUMN IF EXISTS contract_status,
DROP COLUMN IF EXISTS start_date,
DROP COLUMN IF EXISTS end_date,
DROP COLUMN IF EXISTS base_salary,
DROP COLUMN IF EXISTS payment_period,
DROP COLUMN IF EXISTS payment_frequency,
DROP COLUMN IF EXISTS custom_pay_dates,
DROP COLUMN IF EXISTS next_payment_date,
DROP COLUMN IF EXISTS contractor_payment_type,
DROP COLUMN IF EXISTS hourly_rate,
DROP COLUMN IF EXISTS monthly_fixed_amount,
DROP COLUMN IF EXISTS project_details,
DROP COLUMN IF EXISTS employment_terms,
DROP COLUMN IF EXISTS employment_term,
DROP COLUMN IF EXISTS worker_type,
DROP COLUMN IF EXISTS currency,
DROP COLUMN IF EXISTS seniority_level,
DROP COLUMN IF EXISTS working_location,
DROP COLUMN IF EXISTS scope_of_work;

-- Clean up some redundant columns
ALTER TABLE public.workers 
DROP COLUMN IF EXISTS entity,
DROP COLUMN IF EXISTS worker_entity_type,
DROP COLUMN IF EXISTS roles_department;