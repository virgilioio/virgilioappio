-- Add enhanced skills support with categories and metadata
ALTER TABLE candidates 
ADD COLUMN skills_metadata jsonb DEFAULT '[]'::jsonb,
ADD COLUMN auto_generated_skills jsonb DEFAULT '[]'::jsonb,
ADD COLUMN last_skills_generation timestamp with time zone;

-- Add enhanced skills support to job_candidates table as well
ALTER TABLE job_candidates 
ADD COLUMN skills_metadata jsonb DEFAULT '[]'::jsonb,
ADD COLUMN auto_generated_skills jsonb DEFAULT '[]'::jsonb,
ADD COLUMN last_skills_generation timestamp with time zone;

-- Create function to merge and categorize skills
CREATE OR REPLACE FUNCTION public.categorize_skills(
  manual_skills text[],
  generated_skills jsonb
) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result jsonb := '{"technical": [], "tools": [], "industries": [], "titles": [], "soft": [], "certifications": []}'::jsonb;
  skill text;
  generated_skill jsonb;
BEGIN
  -- Process manual skills (default to technical category)
  IF manual_skills IS NOT NULL THEN
    FOR skill IN SELECT unnest(manual_skills)
    LOOP
      result := jsonb_set(
        result, 
        '{technical}', 
        (result->'technical') || jsonb_build_object(
          'name', skill,
          'category', 'technical',
          'source', 'manual',
          'confidence', 1.0
        )
      );
    END LOOP;
  END IF;
  
  -- Process generated skills (keep their categories)
  IF generated_skills IS NOT NULL THEN
    FOR generated_skill IN SELECT jsonb_array_elements(generated_skills)
    LOOP
      result := jsonb_set(
        result,
        concat('{', generated_skill->>'category', '}')::text[],
        (result->(generated_skill->>'category')) || generated_skill
      );
    END LOOP;
  END IF;
  
  RETURN result;
END;
$$;

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_candidates_skills_metadata ON candidates USING GIN(skills_metadata);
CREATE INDEX IF NOT EXISTS idx_candidates_auto_generated_skills ON candidates USING GIN(auto_generated_skills);
CREATE INDEX IF NOT EXISTS idx_job_candidates_skills_metadata ON job_candidates USING GIN(skills_metadata);
CREATE INDEX IF NOT EXISTS idx_job_candidates_auto_generated_skills ON job_candidates USING GIN(auto_generated_skills);