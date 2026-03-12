
-- WhatsApp Conversations table
CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  last_message_at timestamptz DEFAULT now(),
  last_message_preview text,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, candidate_id, job_id)
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view whatsapp conversations in their tenant"
  ON public.whatsapp_conversations FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert whatsapp conversations in their tenant"
  ON public.whatsapp_conversations FOR INSERT TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update whatsapp conversations in their tenant"
  ON public.whatsapp_conversations FOR UPDATE TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

-- WhatsApp Messages table
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  sender_id uuid REFERENCES auth.users(id),
  to_phone text NOT NULL,
  from_phone text NOT NULL,
  body text NOT NULL,
  twilio_sid text,
  status text NOT NULL DEFAULT 'sent',
  direction text NOT NULL DEFAULT 'outbound',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view whatsapp messages in their tenant"
  ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert whatsapp messages in their tenant"
  ON public.whatsapp_messages FOR INSERT TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update whatsapp messages in their tenant"
  ON public.whatsapp_messages FOR UPDATE TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Service role can manage whatsapp conversations"
  ON public.whatsapp_conversations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage whatsapp messages"
  ON public.whatsapp_messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_whatsapp_conversations_tenant ON public.whatsapp_conversations(tenant_id);
CREATE INDEX idx_whatsapp_conversations_candidate ON public.whatsapp_conversations(candidate_id);
CREATE INDEX idx_whatsapp_conversations_job ON public.whatsapp_conversations(job_id);
CREATE INDEX idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_tenant ON public.whatsapp_messages(tenant_id);
CREATE INDEX idx_whatsapp_messages_direction ON public.whatsapp_messages(direction, created_at);
