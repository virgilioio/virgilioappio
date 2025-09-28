-- Phase 1i: Finally update the enum
CREATE TYPE public.member_role_new AS ENUM ('admin', 'recruiter', 'hiring_manager', 'interviewer');

ALTER TABLE public.members 
ALTER COLUMN member_role TYPE public.member_role_new 
USING member_role::text::public.member_role_new;

DROP TYPE public.member_role;
ALTER TYPE public.member_role_new RENAME TO member_role;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_members_user_type_role ON public.members(user_type, member_role);
CREATE INDEX IF NOT EXISTS idx_members_org_role ON public.members(organization_id, member_role);