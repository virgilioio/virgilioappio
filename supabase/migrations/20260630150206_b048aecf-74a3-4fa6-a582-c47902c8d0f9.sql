CREATE INDEX IF NOT EXISTS idx_chat_access_tokens_jti_hash_active
  ON public.chat_access_tokens (jti_hash)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_rate_limits_scope_window
  ON public.chat_rate_limits (scope, scope_key, window_start DESC);