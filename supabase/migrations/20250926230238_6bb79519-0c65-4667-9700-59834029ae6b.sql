-- Phase 1: Database & Storage Cleanup for Invoice System Removal

-- First, clean up all uploaded invoice files from storage bucket
DELETE FROM storage.objects WHERE bucket_id = 'invoices';

-- Drop storage bucket
DELETE FROM storage.buckets WHERE id = 'invoices';

-- Drop invoice-related database functions
DROP FUNCTION IF EXISTS public.add_invoice_payment(uuid, numeric, text, text, text, text, timestamp with time zone, uuid);
DROP FUNCTION IF EXISTS public.update_invoice_payment_totals(uuid);
DROP FUNCTION IF EXISTS public.load_invoice_payments(uuid);
DROP FUNCTION IF EXISTS public.get_organization_currency_rate(text, text, uuid);
DROP FUNCTION IF EXISTS public.get_latest_exchange_rate(text, text);
DROP FUNCTION IF EXISTS public.get_organization_default_currency(uuid);
DROP FUNCTION IF EXISTS public.get_active_organization_currencies();
DROP FUNCTION IF EXISTS public.execute_automatic_exchange_rate_update();
DROP FUNCTION IF EXISTS public.manage_exchange_rate_cron(boolean);
DROP FUNCTION IF EXISTS public.get_exchange_rate_cron_status();

-- Drop invoice-related tables (in dependency order)
DROP TABLE IF EXISTS public.currency_conversions CASCADE;
DROP TABLE IF EXISTS public.invoice_payments CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.currency_exchange_rates CASCADE;
DROP TABLE IF EXISTS public.exchange_rate_update_logs CASCADE;

-- Remove billing-related fields from organizations table
ALTER TABLE public.organizations 
DROP COLUMN IF EXISTS billing_poc_user_id,
DROP COLUMN IF EXISTS default_currency,
DROP COLUMN IF EXISTS billing_address,
DROP COLUMN IF EXISTS tax_id;