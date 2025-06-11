
-- Phase 1: Add 'client' to the member_role enum (100% safe, non-breaking)
ALTER TYPE public.member_role ADD VALUE 'client';
