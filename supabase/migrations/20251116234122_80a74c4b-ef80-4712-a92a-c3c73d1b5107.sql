-- Create ai_conversations and conversation_messages tables for chat-based sourcing

-- Table for storing AI conversations linked to sourcing projects
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sourcing_project_id UUID NOT NULL UNIQUE REFERENCES public.sourcing_projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  initial_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for storing individual messages in conversations
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_ai_conversations_sourcing_project ON public.ai_conversations(sourcing_project_id);
CREATE INDEX idx_ai_conversations_tenant ON public.ai_conversations(tenant_id);
CREATE INDEX idx_conversation_messages_conversation ON public.conversation_messages(conversation_id);
CREATE INDEX idx_conversation_messages_created_at ON public.conversation_messages(created_at);

-- Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_conversations
CREATE POLICY "platform_admin_all_conversations"
  ON public.ai_conversations
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "tenant_members_view_conversations"
  ON public.ai_conversations
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.members 
      WHERE user_id = auth.uid() 
        AND user_status = 'active'
    )
  );

CREATE POLICY "tenant_members_insert_conversations"
  ON public.ai_conversations
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.members 
      WHERE user_id = auth.uid() 
        AND user_status = 'active'
    )
    AND created_by = auth.uid()
  );

-- RLS Policies for conversation_messages
CREATE POLICY "platform_admin_all_messages"
  ON public.conversation_messages
  FOR ALL
  USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "tenant_members_view_messages"
  ON public.conversation_messages
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id 
      FROM public.ai_conversations 
      WHERE tenant_id IN (
        SELECT tenant_id 
        FROM public.members 
        WHERE user_id = auth.uid() 
          AND user_status = 'active'
      )
    )
  );

CREATE POLICY "tenant_members_insert_messages"
  ON public.conversation_messages
  FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id 
      FROM public.ai_conversations 
      WHERE tenant_id IN (
        SELECT tenant_id 
        FROM public.members 
        WHERE user_id = auth.uid() 
          AND user_status = 'active'
      )
    )
  );

-- Trigger to update updated_at on ai_conversations
CREATE OR REPLACE FUNCTION public.update_ai_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_ai_conversation_timestamp
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_conversation_timestamp();