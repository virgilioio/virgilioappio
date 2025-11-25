-- Add 'interview_scheduled' to activity_type enum
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'interview_scheduled';