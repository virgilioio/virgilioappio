ALTER TABLE public.stage_scorecard_templates
ADD COLUMN visibility text NOT NULL DEFAULT 'private'
CONSTRAINT stage_scorecard_templates_visibility_check CHECK (visibility IN ('private', 'public'));