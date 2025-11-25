-- Add missing enum value for member activation activities
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'member_activated';