
CREATE OR REPLACE FUNCTION public.search_standard_terms(
  p_table text,
  p_query text,
  p_limit int DEFAULT 10
)
RETURNS TABLE(canonical text, category text, match_type text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_query IS NULL OR length(trim(p_query)) < 2 THEN
    RETURN;
  END IF;

  IF p_table = 'standard_job_titles' THEN
    RETURN QUERY
      SELECT
        sjt.canonical_title AS canonical,
        sjt.category,
        CASE
          WHEN sjt.canonical_title ILIKE p_query || '%' THEN 'prefix'
          WHEN sjt.canonical_title ILIKE '%' || p_query || '%' THEN 'contains'
          ELSE 'synonym'
        END AS match_type
      FROM standard_job_titles sjt
      WHERE sjt.canonical_title ILIKE '%' || p_query || '%'
         OR EXISTS (SELECT 1 FROM unnest(sjt.synonyms) s WHERE s ILIKE '%' || p_query || '%')
      ORDER BY
        CASE WHEN sjt.canonical_title ILIKE p_query || '%' THEN 0 ELSE 1 END,
        COALESCE(sjt.usage_count, 0) DESC
      LIMIT p_limit;

  ELSIF p_table = 'standard_skills' THEN
    RETURN QUERY
      SELECT
        ss.canonical_name AS canonical,
        ss.category,
        CASE
          WHEN ss.canonical_name ILIKE p_query || '%' THEN 'prefix'
          WHEN ss.canonical_name ILIKE '%' || p_query || '%' THEN 'contains'
          ELSE 'synonym'
        END AS match_type
      FROM standard_skills ss
      WHERE ss.canonical_name ILIKE '%' || p_query || '%'
         OR EXISTS (SELECT 1 FROM unnest(ss.synonyms) s WHERE s ILIKE '%' || p_query || '%')
      ORDER BY
        CASE WHEN ss.canonical_name ILIKE p_query || '%' THEN 0 ELSE 1 END,
        COALESCE(ss.usage_count, 0) DESC
      LIMIT p_limit;

  END IF;
END;
$$;
