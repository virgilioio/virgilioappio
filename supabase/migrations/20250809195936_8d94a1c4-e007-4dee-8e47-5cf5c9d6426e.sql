
-- 1) Add a new "is_default" flag for library-level default inclusion
ALTER TABLE public.application_fields
ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- 2) Backfill from existing "is_required" values so previous intent isn't lost
UPDATE public.application_fields
SET is_default = is_required
WHERE is_required = true;

-- 3) Document the intent of this column
COMMENT ON COLUMN public.application_fields.is_default IS
'When true, this field will be auto-included in new job application forms as a default. Form-level "required" remains a per-form setting.';
