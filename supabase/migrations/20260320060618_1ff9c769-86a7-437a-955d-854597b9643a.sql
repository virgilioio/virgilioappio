
-- Fix AI draft scorecards where general_overview is stored as JSON instead of markdown
-- This converts JSON objects to formatted markdown text

CREATE OR REPLACE FUNCTION pg_temp.convert_json_overview_to_markdown(raw_json jsonb) RETURNS text AS $$
DECLARE
  data jsonb;
  result text := '';
  item text;
BEGIN
  -- Handle nested { general_overview: { ... } } wrapper
  IF raw_json ? 'general_overview' AND jsonb_typeof(raw_json -> 'general_overview') = 'object' THEN
    data := raw_json -> 'general_overview';
  ELSE
    data := raw_json;
  END IF;

  -- Overall Impression
  IF data ? 'overall_impression' AND data ->> 'overall_impression' IS NOT NULL THEN
    result := result || '## Overall Impression' || E'\n\n' || (data ->> 'overall_impression') || E'\n\n';
  END IF;

  -- Key Strengths
  IF data ? 'key_strengths' AND jsonb_typeof(data -> 'key_strengths') = 'array' AND jsonb_array_length(data -> 'key_strengths') > 0 THEN
    result := result || '## Key Strengths' || E'\n\n';
    FOR item IN SELECT jsonb_array_elements_text(data -> 'key_strengths') LOOP
      result := result || '- ' || item || E'\n';
    END LOOP;
    result := result || E'\n';
  END IF;

  -- Areas for Development
  IF data ? 'areas_for_development' AND jsonb_typeof(data -> 'areas_for_development') = 'array' AND jsonb_array_length(data -> 'areas_for_development') > 0 THEN
    result := result || '## Areas for Development' || E'\n\n';
    FOR item IN SELECT jsonb_array_elements_text(data -> 'areas_for_development') LOOP
      result := result || '- ' || item || E'\n';
    END LOOP;
    result := result || E'\n';
  END IF;

  -- Notable Quotes
  IF data ? 'notable_quotes' AND jsonb_typeof(data -> 'notable_quotes') = 'array' AND jsonb_array_length(data -> 'notable_quotes') > 0 THEN
    result := result || '## Notable Quotes' || E'\n\n';
    FOR item IN SELECT jsonb_array_elements_text(data -> 'notable_quotes') LOOP
      result := result || '> ' || item || E'\n\n';
    END LOOP;
  END IF;

  -- Recommended Rating
  IF data ? 'recommended_rating' OR data ? 'justification' THEN
    result := result || '## Recommended Rating: ' || COALESCE(INITCAP(REPLACE(data ->> 'recommended_rating', '_', ' ')), '') || E'\n\n';
    result := result || COALESCE(data ->> 'justification', '') || E'\n';
  END IF;

  RETURN TRIM(result);
END;
$$ LANGUAGE plpgsql;

-- Update the broken records
UPDATE job_stage_scorecards
SET general_overview = pg_temp.convert_json_overview_to_markdown(general_overview::jsonb),
    updated_at = now()
WHERE is_ai_draft = true
  AND general_overview LIKE '{%'
  AND general_overview::jsonb IS NOT NULL;
