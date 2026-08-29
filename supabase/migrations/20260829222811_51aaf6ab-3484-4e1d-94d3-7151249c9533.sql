ALTER TABLE public.reference_templates
  ADD COLUMN IF NOT EXISTS collect_at_stages jsonb NOT NULL DEFAULT '["Final interview","Offer"]'::jsonb;