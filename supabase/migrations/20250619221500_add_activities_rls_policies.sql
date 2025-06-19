
-- Add RLS policies for activities table

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

-- Users can create activities
CREATE POLICY "Users can create activities" 
  ON public.activities 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

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
