
-- Create candidate_attachments table
CREATE TABLE public.candidate_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.job_candidates(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size_bytes integer,
  file_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX idx_candidate_attachments_candidate_id ON public.candidate_attachments(candidate_id);
CREATE INDEX idx_candidate_attachments_uploaded_by ON public.candidate_attachments(uploaded_by);

-- Enable RLS
ALTER TABLE public.candidate_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view attachments for candidates they can access" 
ON public.candidate_attachments FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.job_candidates jc
    JOIN public.jobs j ON jc.job_id = j.id
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE jc.id = candidate_attachments.candidate_id
    AND m.user_id = auth.uid()
    AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.job_candidates jc
    JOIN public.job_assignments ja ON jc.job_id = ja.job_id
    WHERE jc.id = candidate_attachments.candidate_id
    AND ja.user_id = auth.uid()
  )
  OR get_user_type_secure() = 'platform_admin'
);

CREATE POLICY "Users can upload attachments for candidates they can manage" 
ON public.candidate_attachments FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.job_candidates jc
    JOIN public.jobs j ON jc.job_id = j.id
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE jc.id = candidate_attachments.candidate_id
    AND m.user_id = auth.uid()
    AND m.member_role IN ('admin', 'recruiter')
    AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.job_candidates jc
    JOIN public.job_assignments ja ON jc.job_id = ja.job_id
    WHERE jc.id = candidate_attachments.candidate_id
    AND ja.user_id = auth.uid()
  )
  OR get_user_type_secure() = 'platform_admin'
);

CREATE POLICY "Users can delete attachments they uploaded" 
ON public.candidate_attachments FOR DELETE 
USING (
  uploaded_by = auth.uid()
  OR get_user_type_secure() = 'platform_admin'
);

CREATE POLICY "Platform admins can manage all candidate attachments" 
ON public.candidate_attachments FOR ALL 
USING (get_user_type_secure() = 'platform_admin');

-- Create storage bucket for candidate attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candidate-attachments',
  'candidate-attachments',
  false,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif'
  ]
);

-- Storage policies for candidate attachments
CREATE POLICY "Users can view candidate attachments they have access to" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'candidate-attachments'
  AND EXISTS (
    SELECT 1 FROM public.candidate_attachments ca
    WHERE ca.file_url = storage.objects.name
    AND EXISTS (
      SELECT 1 FROM public.job_candidates jc
      JOIN public.jobs j ON jc.job_id = j.id
      JOIN public.members m ON j.organization_id = m.organization_id
      WHERE jc.id = ca.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
    )
  )
);

CREATE POLICY "Users can upload candidate attachments" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'candidate-attachments'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their uploaded attachments" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'candidate-attachments'
  AND EXISTS (
    SELECT 1 FROM public.candidate_attachments ca
    WHERE ca.file_url = storage.objects.name
    AND ca.uploaded_by = auth.uid()
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_candidate_attachments_updated_at
  BEFORE UPDATE ON public.candidate_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
