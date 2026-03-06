ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'approval_requested';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'approval_approved';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'approval_declined';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'approval_recalled';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'offer_document_generated';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'offer_sent';