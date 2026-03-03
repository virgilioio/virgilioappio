
CREATE POLICY "offer_forms_platform_admin" ON public.offer_forms
  FOR ALL USING (get_user_type_secure() = 'platform_admin')
  WITH CHECK (get_user_type_secure() = 'platform_admin');

CREATE POLICY "offer_form_fields_platform_admin" ON public.offer_form_fields
  FOR ALL USING (get_user_type_secure() = 'platform_admin')
  WITH CHECK (get_user_type_secure() = 'platform_admin');
