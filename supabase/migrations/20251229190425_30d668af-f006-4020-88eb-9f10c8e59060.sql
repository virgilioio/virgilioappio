-- Add job_spec_data column to store full AI-generated job specification
ALTER TABLE sourcing_projects 
ADD COLUMN job_spec_data JSONB DEFAULT NULL;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN sourcing_projects.job_spec_data IS 
'Stores the full AI-generated job specification including job_title, alt_titles, job_description, level, department, location, location_details, salary_range, skills, and recommendations. Used for creating jobs from sourcing projects.';