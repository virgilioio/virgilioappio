-- Add columns for storing multiple phone numbers and emails from Apollo
-- These JSONB arrays store objects with type (work, mobile, etc.) and value

ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS contact_phones jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS contact_emails jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.candidates.contact_phones IS 'Array of phone objects: [{type: "work"|"mobile"|"other", number: string, raw_number?: string}]';
COMMENT ON COLUMN public.candidates.contact_emails IS 'Array of email objects: [{type: "work"|"personal"|"other", email: string, status?: string}]';