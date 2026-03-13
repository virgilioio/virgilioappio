
-- Step 1: Add application_review to the stage_type_enum
ALTER TYPE stage_type_enum ADD VALUE IF NOT EXISTS 'application_review';
