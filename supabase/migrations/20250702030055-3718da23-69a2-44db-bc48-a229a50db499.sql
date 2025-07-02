
-- Create password reset tokens table
CREATE TABLE public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  used_at timestamp with time zone NULL
);

-- Add index for better performance
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

-- RLS policies
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow service role to manage tokens (for edge functions)
CREATE POLICY "Service role can manage password reset tokens" ON public.password_reset_tokens
  FOR ALL USING (auth.role() = 'service_role');
