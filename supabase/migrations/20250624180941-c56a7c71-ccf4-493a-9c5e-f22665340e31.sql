
-- Drop the existing constraint that's preventing 'partial' status
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Add the updated constraint that includes 'partial' as a valid status
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'overdue'::text, 'partial'::text]));
