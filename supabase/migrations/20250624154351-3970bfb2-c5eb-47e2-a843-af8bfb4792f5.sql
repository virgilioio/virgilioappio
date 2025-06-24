
-- Create RPC function to load invoice payments
CREATE OR REPLACE FUNCTION public.load_invoice_payments(invoice_id_param UUID)
RETURNS TABLE(
  id UUID,
  amount NUMERIC,
  currency TEXT,
  payment_date TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  payment_reference TEXT,
  payment_notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ip.id,
    ip.amount,
    ip.currency,
    ip.payment_date,
    ip.payment_method,
    ip.payment_reference,
    ip.payment_notes
  FROM public.invoice_payments ip
  WHERE ip.invoice_id = invoice_id_param
  ORDER BY ip.payment_date DESC;
END;
$$;

-- Create RPC function to add invoice payment
CREATE OR REPLACE FUNCTION public.add_invoice_payment(
  invoice_id_param UUID,
  amount_param NUMERIC,
  currency_param TEXT,
  payment_method_param TEXT,
  payment_reference_param TEXT DEFAULT NULL,
  payment_notes_param TEXT DEFAULT NULL,
  payment_date_param TIMESTAMP WITH TIME ZONE DEFAULT now(),
  recorded_by_param UUID DEFAULT auth.uid()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert the payment record
  INSERT INTO public.invoice_payments (
    invoice_id,
    amount,
    currency,
    payment_method,
    payment_reference,
    payment_notes,
    payment_date,
    recorded_by
  ) VALUES (
    invoice_id_param,
    amount_param,
    currency_param,
    payment_method_param,
    payment_reference_param,
    payment_notes_param,
    payment_date_param,
    recorded_by_param
  );
END;
$$;
