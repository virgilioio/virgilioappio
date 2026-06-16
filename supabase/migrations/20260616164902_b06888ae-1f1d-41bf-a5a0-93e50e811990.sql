-- Add visibility column to saved_views for private/shared views
ALTER TABLE public.saved_views
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

ALTER TABLE public.saved_views
  DROP CONSTRAINT IF EXISTS saved_views_visibility_check;
ALTER TABLE public.saved_views
  ADD CONSTRAINT saved_views_visibility_check CHECK (visibility IN ('private','shared'));

CREATE INDEX IF NOT EXISTS saved_views_tenant_page_visibility_idx
  ON public.saved_views (tenant_id, page_context, visibility);

-- Update RLS: allow reading shared views from the same tenant
DROP POLICY IF EXISTS "Users can view their own saved views" ON public.saved_views;
DROP POLICY IF EXISTS "saved_views_select" ON public.saved_views;
DROP POLICY IF EXISTS "saved_views_select_own_or_shared" ON public.saved_views;

CREATE POLICY "saved_views_select_own_or_shared"
  ON public.saved_views
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      visibility = 'shared'
      AND tenant_id IN (
        SELECT m.tenant_id FROM public.members m WHERE m.user_id = auth.uid()
      )
    )
  );