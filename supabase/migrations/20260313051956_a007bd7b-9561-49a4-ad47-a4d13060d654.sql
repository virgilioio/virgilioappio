-- =============================================================
-- WhatsApp Provider Integration Architecture - Schema Changes
-- =============================================================

-- 1. Extend whatsapp_conversations for provider-agnostic sync
-- Make candidate_id nullable (conversations can exist before linking)
ALTER TABLE whatsapp_conversations 
  ALTER COLUMN candidate_id DROP NOT NULL;

ALTER TABLE whatsapp_conversations 
  ADD COLUMN IF NOT EXISTS provider_chat_id text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS is_manually_linked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_by uuid,
  ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS provider_metadata jsonb DEFAULT '{}';

-- Create unique index on provider_chat_id per tenant to support idempotent upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_conversations_provider_chat 
  ON whatsapp_conversations(tenant_id, provider_chat_id) 
  WHERE provider_chat_id IS NOT NULL;

-- Create index for phone-based candidate matching
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone 
  ON whatsapp_conversations(tenant_id, phone_number);

-- 2. Extend whatsapp_messages for provider-agnostic sync
-- Rename twilio_sid to provider_message_id (more generic)
ALTER TABLE whatsapp_messages 
  RENAME COLUMN twilio_sid TO provider_message_id;

-- Make candidate_id nullable (messages in unlinked conversations)
ALTER TABLE whatsapp_messages 
  ALTER COLUMN candidate_id DROP NOT NULL;

-- Add provider-agnostic fields
ALTER TABLE whatsapp_messages 
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS provider_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS provider_metadata jsonb DEFAULT '{}';

-- Create unique index for idempotent message upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_provider_id 
  ON whatsapp_messages(conversation_id, provider_message_id) 
  WHERE provider_message_id IS NOT NULL;

-- 3. Create whatsapp_sessions table for persisted provider session state
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'evolution_api',
  provider_session_id text,
  session_status text NOT NULL DEFAULT 'disconnected',
  connected_phone text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  conversation_count integer DEFAULT 0,
  qr_code_data text,
  qr_expires_at timestamptz,
  provider_metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT one_session_per_tenant UNIQUE (tenant_id)
);

-- Enable RLS
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_sessions (tenant-scoped)
CREATE POLICY "Users can view their tenant WhatsApp session"
  ON whatsapp_sessions FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT m.tenant_id FROM members m 
    WHERE m.user_id = auth.uid() AND m.user_status = 'active'
  ));

CREATE POLICY "Users can manage their tenant WhatsApp session"
  ON whatsapp_sessions FOR ALL
  TO authenticated
  USING (tenant_id IN (
    SELECT m.tenant_id FROM members m 
    WHERE m.user_id = auth.uid() AND m.user_status = 'active'
  ))
  WITH CHECK (tenant_id IN (
    SELECT m.tenant_id FROM members m 
    WHERE m.user_id = auth.uid() AND m.user_status = 'active'
  ));

-- Auto-update updated_at on whatsapp_sessions
CREATE OR REPLACE FUNCTION update_whatsapp_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whatsapp_sessions_updated_at
  BEFORE UPDATE ON whatsapp_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_sessions_updated_at();

-- 4. Create a phone-matching helper function for candidate linking
CREATE OR REPLACE FUNCTION match_candidates_by_phone(
  p_tenant_id uuid,
  p_phone_number text
)
RETURNS TABLE(
  candidate_id uuid,
  candidate_name text,
  phone text,
  email text,
  current_job_title text,
  match_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_phone text;
BEGIN
  -- Normalize: strip all non-digits
  normalized_phone := regexp_replace(p_phone_number, '[^\d]', '', 'g');
  
  -- Return candidates matching on any phone field
  RETURN QUERY
  SELECT DISTINCT ON (c.id)
    c.id as candidate_id,
    c.candidate_name,
    COALESCE(c.phone, c.contact_phone) as phone,
    COALESCE(c.email, c.contact_email) as email,
    c.current_job_title,
    CASE 
      WHEN regexp_replace(COALESCE(c.phone, ''), '[^\d]', '', 'g') = normalized_phone THEN 'exact'
      WHEN regexp_replace(COALESCE(c.contact_phone, ''), '[^\d]', '', 'g') = normalized_phone THEN 'exact'
      WHEN EXISTS (
        SELECT 1 FROM unnest(c.contact_phones) cp 
        WHERE regexp_replace(cp, '[^\d]', '', 'g') = normalized_phone
      ) THEN 'exact'
      WHEN LENGTH(normalized_phone) >= 10 AND (
        RIGHT(regexp_replace(COALESCE(c.phone, ''), '[^\d]', '', 'g'), 10) = RIGHT(normalized_phone, 10)
        OR RIGHT(regexp_replace(COALESCE(c.contact_phone, ''), '[^\d]', '', 'g'), 10) = RIGHT(normalized_phone, 10)
      ) THEN 'suffix'
      ELSE 'fuzzy'
    END as match_type
  FROM candidates c
  WHERE c.tenant_id = p_tenant_id
    AND c.deleted_at IS NULL
    AND (
      regexp_replace(COALESCE(c.phone, ''), '[^\d]', '', 'g') = normalized_phone
      OR regexp_replace(COALESCE(c.contact_phone, ''), '[^\d]', '', 'g') = normalized_phone
      OR EXISTS (
        SELECT 1 FROM unnest(c.contact_phones) cp 
        WHERE regexp_replace(cp, '[^\d]', '', 'g') = normalized_phone
      )
      OR (LENGTH(normalized_phone) >= 10 AND (
        RIGHT(regexp_replace(COALESCE(c.phone, ''), '[^\d]', '', 'g'), 10) = RIGHT(normalized_phone, 10)
        OR RIGHT(regexp_replace(COALESCE(c.contact_phone, ''), '[^\d]', '', 'g'), 10) = RIGHT(normalized_phone, 10)
      ))
    )
  ORDER BY c.id, 
    CASE 
      WHEN regexp_replace(COALESCE(c.phone, ''), '[^\d]', '', 'g') = normalized_phone THEN 1
      WHEN regexp_replace(COALESCE(c.contact_phone, ''), '[^\d]', '', 'g') = normalized_phone THEN 1
      ELSE 2
    END
  LIMIT 10;
END;
$$;