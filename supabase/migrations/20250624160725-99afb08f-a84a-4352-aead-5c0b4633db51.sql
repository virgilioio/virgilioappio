
-- Create a non-recursive version of get_user_type that bypasses RLS completely
CREATE OR REPLACE FUNCTION public.get_user_type_safe()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_type_result text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 'guest';
  END IF;
  
  -- First check auth metadata for platform admin
  IF (auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin' THEN
    RETURN 'platform_admin';
  END IF;
  
  -- Use a direct query with SECURITY DEFINER to bypass RLS completely
  SELECT COALESCE(user_type::text, 'guest') INTO user_type_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$$;

-- Create a non-recursive version of get_member_role that bypasses RLS completely  
CREATE OR REPLACE FUNCTION public.get_member_role_safe()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  member_role_result text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 'guest';
  END IF;
  
  -- Use a direct query with SECURITY DEFINER to bypass RLS completely
  SELECT COALESCE(member_role::text, 'guest') INTO member_role_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  RETURN COALESCE(member_role_result, 'guest');
END;
$$;

-- Update invoice_payments policies to use the safe functions
DROP POLICY IF EXISTS "Users can view payment records for accessible invoices" ON public.invoice_payments;
DROP POLICY IF EXISTS "Users can insert payment records for accessible invoices" ON public.invoice_payments;

CREATE POLICY "Users can view payment records for accessible invoices"
  ON public.invoice_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_payments.invoice_id
      AND (
        -- Use safe function to check platform admin
        get_user_type_safe() = 'platform_admin'
        OR
        -- Direct organization check for members
        EXISTS (
          SELECT 1 FROM public.members m 
          WHERE m.user_id = auth.uid() 
          AND m.organization_id = i.organization_id 
          AND m.user_status = 'active'
        )
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
        -- Use safe function to check platform admin
        get_user_type_safe() = 'platform_admin'
        OR
        -- Direct organization check for members
        EXISTS (
          SELECT 1 FROM public.members m 
          WHERE m.user_id = auth.uid() 
          AND m.organization_id = i.organization_id 
          AND m.user_status = 'active'
        )
      )
    )
  );
