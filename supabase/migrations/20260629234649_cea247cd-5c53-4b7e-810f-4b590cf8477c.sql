ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS chat_paused boolean NOT NULL DEFAULT false;