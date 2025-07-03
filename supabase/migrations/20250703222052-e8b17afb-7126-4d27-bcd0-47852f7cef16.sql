-- Allow authenticated users to view offer templates (for recruiters to create offer letters)
CREATE POLICY "Authenticated users can view offer templates" ON public.offer_templates
FOR SELECT 
TO authenticated 
USING (true);

-- Allow authenticated users to view offer template fields (for recruiters to see custom fields)
CREATE POLICY "Authenticated users can view offer template fields" ON public.offer_template_fields
FOR SELECT 
TO authenticated 
USING (true);