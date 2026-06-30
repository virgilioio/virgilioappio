-- Phase 5.1 — Email channel tracking columns
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS external_message_id text,
  ADD COLUMN IF NOT EXISTS email_opened_at     timestamptz;

CREATE INDEX IF NOT EXISTS idx_chat_messages_external_message_id
  ON public.chat_messages(external_message_id)
  WHERE external_message_id IS NOT NULL;

ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS email_subject       text,
  ADD COLUMN IF NOT EXISTS external_thread_ref text;
