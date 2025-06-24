
-- Create the invoice_payments table
CREATE TABLE public.invoice_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payment_method TEXT NOT NULL,
  payment_reference TEXT,
  payment_notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX idx_invoice_payments_invoice_id ON public.invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_payment_date ON public.invoice_payments(payment_date);

-- Enable RLS
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_payments
CREATE POLICY "Users can view payment records for accessible invoices"
  ON public.invoice_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_payments.invoice_id
      AND (
        -- Platform admins can see all
        get_user_type() = 'platform_admin'
        OR
        -- Organization members can see their org's invoices
        i.organization_id = get_user_organization_id()
      )
    )
  );

CREATE POLICY "Users can insert payment records for accessible invoices"
  ON public.invoice_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_payments.invoice_id
      AND (
        -- Platform admins can add payments to all invoices
        get_user_type() = 'platform_admin'
        OR
        -- Organization members can add payments to their org's invoices
        i.organization_id = get_user_organization_id()
      )
    )
  );

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at_invoice_payments
  BEFORE UPDATE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add new columns to invoices table for payment tracking
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS total_paid NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC;

-- Function to calculate and update invoice payment totals
CREATE OR REPLACE FUNCTION public.update_invoice_payment_totals(invoice_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invoice_amount NUMERIC;
  total_payments NUMERIC;
  new_status TEXT;
BEGIN
  -- Get the invoice amount
  SELECT amount INTO invoice_amount
  FROM public.invoices
  WHERE id = invoice_id_param;
  
  -- Calculate total payments
  SELECT COALESCE(SUM(amount), 0) INTO total_payments
  FROM public.invoice_payments
  WHERE invoice_id = invoice_id_param;
  
  -- Determine new status
  IF total_payments = 0 THEN
    new_status := 'pending';
  ELSIF total_payments >= invoice_amount THEN
    new_status := 'paid';
  ELSE
    new_status := 'partial';
  END IF;
  
  -- Update the invoice
  UPDATE public.invoices
  SET 
    total_paid = total_payments,
    remaining_amount = invoice_amount - total_payments,
    status = new_status,
    updated_at = now()
  WHERE id = invoice_id_param;
END;
$$;

-- Trigger to automatically update invoice totals when payments change
CREATE OR REPLACE FUNCTION public.handle_invoice_payment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM public.update_invoice_payment_totals(NEW.invoice_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.update_invoice_payment_totals(OLD.invoice_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Add triggers for payment changes
CREATE TRIGGER trigger_invoice_payment_change
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_invoice_payment_change();

-- Update existing invoices to have correct remaining_amount
UPDATE public.invoices 
SET 
  total_paid = COALESCE(total_paid, 0),
  remaining_amount = amount - COALESCE(total_paid, 0)
WHERE remaining_amount IS NULL;
