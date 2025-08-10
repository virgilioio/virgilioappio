-- Add column_span to support multi-column form layout
BEGIN;

-- 1) Add column with default and not null
ALTER TABLE public.job_posting_application_fields
  ADD COLUMN IF NOT EXISTS column_span integer NOT NULL DEFAULT 1;

-- 2) Ensure values are constrained between 1 and 4
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_posting_application_fields_column_span_check'
  ) THEN
    ALTER TABLE public.job_posting_application_fields
      ADD CONSTRAINT job_posting_application_fields_column_span_check
      CHECK (column_span >= 1 AND column_span <= 4);
  END IF;
END $$;

-- 3) Backfill existing rows explicitly to be safe (in case of older PG behavior)
UPDATE public.job_posting_application_fields
SET column_span = 1
WHERE column_span IS DISTINCT FROM 1;

COMMIT;