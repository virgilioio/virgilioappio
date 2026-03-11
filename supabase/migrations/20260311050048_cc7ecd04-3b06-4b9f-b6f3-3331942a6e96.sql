
-- Create saved_views table for persisting filter views across pages
CREATE TABLE public.saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  page_context TEXT NOT NULL CHECK (page_context IN ('pipeline', 'candidates', 'analytics', 'talent-intelligence')),
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  sort_state JSONB DEFAULT NULL,
  extra_state JSONB DEFAULT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_saved_views_user_page ON public.saved_views(user_id, page_context);
CREATE INDEX idx_saved_views_tenant ON public.saved_views(tenant_id);

-- Only one default view per user per page
CREATE UNIQUE INDEX idx_saved_views_default ON public.saved_views(user_id, page_context) WHERE is_default = true;

-- RLS
ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

-- Users can only see their own saved views
CREATE POLICY "Users can view own saved views"
  ON public.saved_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own saved views"
  ON public.saved_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved views"
  ON public.saved_views FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved views"
  ON public.saved_views FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_saved_views_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_saved_views_updated_at
  BEFORE UPDATE ON public.saved_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_saved_views_updated_at();
