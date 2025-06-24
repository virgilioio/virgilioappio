
-- Drop the existing problematic policies
DROP POLICY IF EXISTS "Users can view payment records for accessible invoices" ON public.invoice_payments;
DROP POLICY IF EXISTS "Users can insert payment records for accessible invoices" ON public.invoice_payments;

-- Create new RLS policies that avoid recursion by using direct auth.uid() checks
CREATE POLICY "Users can view payment records for accessible invoices"
  ON public.invoice_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      LEFT JOIN public.members m ON i.organization_id = m.organization_id
      WHERE i.id = invoice_payments.invoice_id
      AND (
        -- Direct check for platform admin from auth metadata
        (auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin'
        OR
        -- Organization members can see their org's invoices
        (m.user_id = auth.uid() AND m.user_status = 'active')
      )
    )
  );

CREATE POLICY "Users can insert payment records for accessible invoices"
  ON public.invoice_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      LEFT JOIN public.members m ON i.organization_id = m.organization_id
      WHERE i.id = invoice_payments.invoice_id
      AND (
        -- Direct check for platform admin from auth metadata
        (auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin'
        OR
        -- Organization members can add payments to their org's invoices
        (m.user_id = auth.uid() AND m.user_status = 'active')
      )
    )
  );
