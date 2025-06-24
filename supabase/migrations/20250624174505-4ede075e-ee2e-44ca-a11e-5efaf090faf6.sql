
-- Drop all existing problematic invoice_payments policies
DROP POLICY IF EXISTS "Users can view payment records for accessible invoices" ON public.invoice_payments;
DROP POLICY IF EXISTS "Users can insert payment records for accessible invoices" ON public.invoice_payments;

-- Create simple platform admin-only policies that avoid all recursion
CREATE POLICY "Platform admins can view all payment records"
  ON public.invoice_payments FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Platform admins can insert payment records"
  ON public.invoice_payments FOR INSERT
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Platform admins can update payment records"
  ON public.invoice_payments FOR UPDATE
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');

CREATE POLICY "Platform admins can delete payment records"
  ON public.invoice_payments FOR DELETE
  USING ((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin');
