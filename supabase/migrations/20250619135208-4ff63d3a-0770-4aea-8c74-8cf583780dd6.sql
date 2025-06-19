
-- Create an enum for activity types
CREATE TYPE public.activity_type AS ENUM (
  'job_created',
  'job_updated',
  'job_published',
  'job_archived',
  'member_invited',
  'member_joined',
  'job_request_created',
  'job_request_approved',
  'job_request_rejected',
  'candidate_added',
  'invoice_created',
  'invoice_paid'
);

-- Create the activities table
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID,
  activity_type activity_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_activities_user_id ON public.activities(user_id);
CREATE INDEX idx_activities_organization_id ON public.activities(organization_id);
CREATE INDEX idx_activities_created_at ON public.activities(created_at DESC);
CREATE INDEX idx_activities_type ON public.activities(activity_type);

-- Enable Row Level Security
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- Add trigger for updated_at if we need it later
CREATE OR REPLACE FUNCTION public.handle_activities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
