-- Final security fixes for remaining functions
-- Add proper search_path protection to remaining functions

-- Fix remaining critical security definer functions
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.email
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_member_display_info(member_user_id uuid)
RETURNS TABLE(first_name text, last_name text, email text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only allow if current user is platform admin or in same org
  IF get_user_type() = 'platform_admin' OR 
     EXISTS (
       SELECT 1 FROM public.members m1, public.members m2
       WHERE m1.user_id = auth.uid()
         AND m2.user_id = member_user_id
         AND m1.organization_id = m2.organization_id
     ) THEN
    
    RETURN QUERY
    SELECT p.first_name, p.last_name, au.email::text
    FROM public.profiles p
    LEFT JOIN auth.users au ON p.user_id = au.id
    WHERE p.user_id = member_user_id;
  END IF;
  
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_user_assigned_to_job(job_id_param uuid, user_id_param uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.job_assignments
    WHERE job_id = job_id_param AND user_id = user_id_param
  );
$function$;

CREATE OR REPLACE FUNCTION public.debug_user_permissions()
RETURNS TABLE(current_user_id uuid, user_type text, member_role text, organization_id uuid, member_count bigint, can_see_all_orgs boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as current_user_id,
    get_user_type() as user_type,
    get_member_role() as member_role,
    get_user_organization_id() as organization_id,
    (SELECT COUNT(*) FROM public.members WHERE user_id = auth.uid()) as member_count,
    (get_user_type() = 'platform_admin') as can_see_all_orgs;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_platform_admin_access()
RETURNS TABLE(user_email text, user_id uuid, has_member_record boolean, user_type text, member_role text, organization_id uuid, issue_description text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    au.email::text as user_email,
    au.id as user_id,
    (m.user_id IS NOT NULL) as has_member_record,
    COALESCE(m.user_type::text, 'NO_RECORD') as user_type,
    COALESCE(m.member_role::text, 'NO_RECORD') as member_role,
    m.organization_id,
    CASE 
      WHEN au.raw_user_meta_data->>'user_type' = 'platform_admin' AND m.user_id IS NULL 
        THEN 'Platform admin has no member record'
      WHEN au.raw_user_meta_data->>'user_type' = 'platform_admin' AND m.user_type::text != 'platform_admin'
        THEN 'Platform admin has incorrect user_type in members table'
      WHEN au.raw_user_meta_data->>'user_type' = 'platform_admin' AND m.organization_id IS NULL
        THEN 'Platform admin has no organization assignment'
      ELSE 'OK'
    END as issue_description
  FROM auth.users au
  LEFT JOIN public.members m ON au.id = m.user_id
  WHERE au.raw_user_meta_data->>'user_type' = 'platform_admin'
  ORDER BY au.email;
END;
$function$;

CREATE OR REPLACE FUNCTION public.load_invoice_payments(invoice_id_param uuid)
RETURNS TABLE(id uuid, amount numeric, currency text, payment_date timestamp with time zone, payment_method text, payment_reference text, payment_notes text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.add_invoice_payment(invoice_id_param uuid, amount_param numeric, currency_param text, payment_method_param text, payment_reference_param text DEFAULT NULL::text, payment_notes_param text DEFAULT NULL::text, payment_date_param timestamp with time zone DEFAULT now(), recorded_by_param uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_invoice_payment_totals(invoice_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

-- Create audit logs table if needed and ensure secure access
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Platform admins can view audit logs" ON public.audit_logs;

-- Only platform admins can view audit logs
CREATE POLICY "Platform admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (get_user_type_secure() = 'platform_admin');