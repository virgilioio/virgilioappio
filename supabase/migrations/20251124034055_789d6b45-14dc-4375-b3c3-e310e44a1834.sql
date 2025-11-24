-- Drop the deprecated 'level' column from the jobs table
ALTER TABLE jobs DROP COLUMN IF EXISTS level CASCADE;

-- Drop the enum type (safe because no other tables use it)
DROP TYPE IF EXISTS job_level CASCADE;