-- deals: close outcome
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS won_at timestamptz,
  ADD COLUMN IF NOT EXISTS lost_at timestamptz,
  ADD COLUMN IF NOT EXISTS lost_reason text;

-- deal_payments: status / scheduling
DO $$ BEGIN
  CREATE TYPE public.deal_payment_status AS ENUM ('paid','due');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.deal_payments
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS status public.deal_payment_status NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS due_on date;

-- Make paid_at nullable for 'due' payments
ALTER TABLE public.deal_payments ALTER COLUMN paid_at DROP NOT NULL;

-- deal_invoices: optional kind for documents
ALTER TABLE public.deal_invoices
  ADD COLUMN IF NOT EXISTS kind text;