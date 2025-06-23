
-- Add RLS policies for activities table to allow proper data access

-- Users can view activities in their organization or their own activities
CREATE POLICY "Users can view activities in their organization" 
  ON public.activities 
  FOR SELECT 
  USING (
    user_id = auth.uid() OR 
    organization_id IN (
      SELECT organization_id 
      FROM public.members 
      WHERE user_id = auth.uid()
    )
  );

-- Platform admins can view all activities
CREATE POLICY "Platform admins can view all activities" 
  ON public.activities 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'user_type' = 'platform_admin'
    )
  );

-- Users can update their own activities
CREATE POLICY "Users can update their own activities" 
  ON public.activities 
  FOR UPDATE 
  USING (user_id = auth.uid());

-- Users can delete their own activities  
CREATE POLICY "Users can delete their own activities" 
  ON public.activities 
  FOR DELETE 
  USING (user_id = auth.uid());
