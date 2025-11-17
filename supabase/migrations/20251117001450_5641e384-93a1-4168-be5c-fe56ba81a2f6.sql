-- Phase 1: Database Schema for Draft Conversations

-- Make sourcing_project_id nullable to support draft conversations
ALTER TABLE public.ai_conversations 
  ALTER COLUMN sourcing_project_id DROP NOT NULL;

-- Add status column
CREATE TYPE public.conversation_status AS ENUM ('draft', 'active');

ALTER TABLE public.ai_conversations 
  ADD COLUMN status public.conversation_status DEFAULT 'draft' NOT NULL;

-- Add is_ready_for_creation flag
ALTER TABLE public.ai_conversations 
  ADD COLUMN is_ready_for_creation boolean DEFAULT false NOT NULL;

-- Add expires_at for draft cleanup
ALTER TABLE public.ai_conversations 
  ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '7 days');

-- Update RLS policies to allow draft conversations
DROP POLICY IF EXISTS "ai_conversations_select" ON public.ai_conversations;
DROP POLICY IF EXISTS "ai_conversations_insert" ON public.ai_conversations;
DROP POLICY IF EXISTS "ai_conversations_update" ON public.ai_conversations;

-- Allow users to view draft conversations in their tenant
CREATE POLICY "ai_conversations_select" ON public.ai_conversations
  FOR SELECT USING (
    get_user_tenant_id() = tenant_id OR
    is_platform_admin()
  );

-- Allow users to create draft conversations
CREATE POLICY "ai_conversations_insert" ON public.ai_conversations
  FOR INSERT WITH CHECK (
    get_user_tenant_id() = tenant_id
  );

-- Allow users to update their own draft conversations
CREATE POLICY "ai_conversations_update" ON public.ai_conversations
  FOR UPDATE USING (
    get_user_tenant_id() = tenant_id
  );

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_ai_conversations_status_tenant 
  ON public.ai_conversations(status, tenant_id) 
  WHERE status = 'draft';

-- Trigger to auto-delete expired draft conversations
CREATE OR REPLACE FUNCTION public.cleanup_expired_draft_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ai_conversations
  WHERE status = 'draft' 
    AND expires_at < now();
END;
$$;

-- Schedule cleanup (would need pg_cron extension, commenting for now)
-- SELECT cron.schedule('cleanup-drafts', '0 0 * * *', 'SELECT public.cleanup_expired_draft_conversations()');

COMMENT ON COLUMN public.ai_conversations.status IS 'Conversation status: draft (pre-creation) or active (linked to project)';
COMMENT ON COLUMN public.ai_conversations.is_ready_for_creation IS 'AI assessment of whether enough info is gathered to create job specs';
COMMENT ON COLUMN public.ai_conversations.expires_at IS 'Expiration date for draft conversations (7 days from creation)';