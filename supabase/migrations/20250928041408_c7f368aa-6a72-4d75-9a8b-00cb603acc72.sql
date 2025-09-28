-- Remove Worker Management Features
-- This migration removes all worker-related tables and enums to simplify the platform

-- Drop worker-related tables
DROP TABLE IF EXISTS public.worker_custom_data CASCADE;
DROP TABLE IF EXISTS public.worker_compliance_field_options CASCADE;
DROP TABLE IF EXISTS public.worker_compliance_field_validation_rules CASCADE;

-- Drop worker-related enums
DROP TYPE IF EXISTS public.worker_entity_type_enum CASCADE;
DROP TYPE IF EXISTS public.worker_status_enum CASCADE;
DROP TYPE IF EXISTS public.worker_type_enum CASCADE;