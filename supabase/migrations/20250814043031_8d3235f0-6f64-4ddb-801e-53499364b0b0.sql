-- Add conversion tracking fields to candidate_attachments table
ALTER TABLE public.candidate_attachments 
ADD COLUMN converted_pdf_url text,
ADD COLUMN conversion_status text DEFAULT 'pending' CHECK (conversion_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN conversion_error text,
ADD COLUMN converted_at timestamp with time zone;

-- Create index for faster queries on conversion status
CREATE INDEX idx_candidate_attachments_conversion_status ON public.candidate_attachments(conversion_status);

-- Create function to trigger conversion for non-PDF files
CREATE OR REPLACE FUNCTION public.trigger_document_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Only trigger conversion for non-PDF files
  IF NEW.file_type IS NOT NULL AND NEW.file_type != 'application/pdf' THEN
    -- Call edge function for conversion (will be handled asynchronously)
    PERFORM net.http_post(
      url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/convert-document-to-pdf',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cnhqeHN0amZjb3pkanVtZnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MzM3MjMsImV4cCI6MjA2NTEwOTcyM30.xhhEmT2ikIqFO9IiZZC22zhWlSTC-ytBxP6EGGXtC44"}'::jsonb,
      body := json_build_object(
        'attachment_id', NEW.id,
        'file_url', NEW.file_url,
        'file_type', NEW.file_type
      )::jsonb
    );
    
    -- Set initial conversion status
    NEW.conversion_status := 'processing';
  ELSE
    -- For PDF files, mark as completed (no conversion needed)
    NEW.conversion_status := 'completed';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to automatically start conversion on file upload
CREATE TRIGGER trigger_document_conversion_on_insert
  BEFORE INSERT ON public.candidate_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_document_conversion();