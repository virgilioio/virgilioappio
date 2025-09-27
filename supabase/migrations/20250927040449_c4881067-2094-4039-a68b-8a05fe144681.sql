-- Phase 3: Database Cleanup for People Hub Removal

-- Step 1: Drop worker-related functions first
DROP FUNCTION IF EXISTS public.assign_worker_id() CASCADE;
DROP FUNCTION IF EXISTS public.generate_worker_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.assign_contract_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_contract_number(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.handle_invoice_payment_change() CASCADE;
DROP FUNCTION IF EXISTS public.update_invoice_payment_totals(uuid) CASCADE;

-- Step 2: Drop worker-related tables in dependency order

-- Drop tables with foreign keys first
DROP TABLE IF EXISTS public.worker_contract_payments CASCADE;
DROP TABLE IF EXISTS public.worker_contract_invoices CASCADE;
DROP TABLE IF EXISTS public.worker_contracts CASCADE;
DROP TABLE IF EXISTS public.worker_compliance_data CASCADE;
DROP TABLE IF EXISTS public.worker_compliance_fields CASCADE;
DROP TABLE IF EXISTS public.worker_compliance_countries CASCADE;
DROP TABLE IF EXISTS public.worker_contract_templates CASCADE;
DROP TABLE IF EXISTS public.worker_contract_template_fields CASCADE;

-- Drop main worker tables
DROP TABLE IF EXISTS public.workers CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;

-- Step 3: Clean up any remaining worker-related sequences
DROP SEQUENCE IF EXISTS public.workers_worker_id_seq CASCADE;

-- Step 4: Remove worker-related types
DROP TYPE IF EXISTS public.worker_type CASCADE;
DROP TYPE IF EXISTS public.worker_status CASCADE;
DROP TYPE IF EXISTS public.contractor_payment_type CASCADE;
DROP TYPE IF EXISTS public.employment_term CASCADE;
DROP TYPE IF EXISTS public.contract_status CASCADE;
DROP TYPE IF EXISTS public.invoice_status CASCADE;
DROP TYPE IF EXISTS public.payment_status CASCADE;