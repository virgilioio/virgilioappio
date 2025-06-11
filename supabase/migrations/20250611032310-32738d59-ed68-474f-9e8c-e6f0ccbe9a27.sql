
-- Phase 3: Add payment tracking fields to invoices table
-- Add new nullable fields for payment metadata

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS payment_reference text,
ADD COLUMN IF NOT EXISTS payment_notes text;

-- Add a check constraint to ensure paid_at is only set when status is 'paid'
-- Using a trigger instead of CHECK constraint to avoid immutability issues
CREATE OR REPLACE FUNCTION validate_invoice_payment_data()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is 'paid', paid_at should be set
  IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN
    NEW.paid_at = COALESCE(NEW.paid_at, now());
  END IF;
  
  -- If status is not 'paid', clear payment fields
  IF NEW.status != 'paid' THEN
    NEW.paid_at = NULL;
    NEW.payment_method = NULL;
    NEW.payment_reference = NULL;
    NEW.payment_notes = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate payment data
DROP TRIGGER IF EXISTS validate_invoice_payment_trigger ON public.invoices;
CREATE TRIGGER validate_invoice_payment_trigger
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION validate_invoice_payment_data();

-- Update existing 'paid' invoices to have a paid_at timestamp if they don't have one
UPDATE public.invoices 
SET paid_at = updated_at 
WHERE status = 'paid' AND paid_at IS NULL;
