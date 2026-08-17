CREATE TABLE public.dashboard_queue_dismissals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id uuid,
  item_key text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_queue_dismissals_unique UNIQUE (user_id, item_key)
);

CREATE INDEX idx_dashboard_queue_dismissals_user ON public.dashboard_queue_dismissals(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_queue_dismissals TO authenticated;
GRANT ALL ON public.dashboard_queue_dismissals TO service_role;

ALTER TABLE public.dashboard_queue_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own queue dismissals"
ON public.dashboard_queue_dismissals
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());