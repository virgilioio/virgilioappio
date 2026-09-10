ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'candidate_email_automated';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'automation_triggered';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'automation_skipped';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'sequence_enrolled';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'sequence_completed';