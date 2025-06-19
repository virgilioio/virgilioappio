
-- Add billing POC columns to organizations table
ALTER TABLE public.organizations 
ADD COLUMN billing_poc_user_id uuid REFERENCES auth.users(id),
ADD COLUMN billing_poc_additional_email text,
ADD COLUMN billing_poc_phone text;

-- Add index for better query performance
CREATE INDEX idx_organizations_billing_poc_user_id ON public.organizations(billing_poc_user_id);

-- Add audit columns for compliance tracking
ALTER TABLE public.organizations 
ADD COLUMN billing_poc_updated_by uuid REFERENCES auth.users(id),
ADD COLUMN billing_poc_updated_at timestamp with time zone;
