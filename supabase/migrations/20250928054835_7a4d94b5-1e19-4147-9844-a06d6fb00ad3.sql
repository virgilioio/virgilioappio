-- Phase 1a: Add new enum values (must be in separate transaction)
ALTER TYPE public.member_role ADD VALUE IF NOT EXISTS 'hiring_manager';
ALTER TYPE public.member_role ADD VALUE IF NOT EXISTS 'interviewer';