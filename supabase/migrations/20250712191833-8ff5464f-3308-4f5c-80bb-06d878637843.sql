-- Create enrichment logging table to track library improvements
CREATE TABLE public.library_enrichment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrichment_type TEXT NOT NULL, -- 'skills', 'job_titles', 'locations'
  source_search_id TEXT, -- reference to the search that triggered this
  extracted_terms JSONB NOT NULL, -- raw terms extracted from candidates
  ai_suggestions JSONB, -- AI clustering/suggestions
  additions_made JSONB, -- what was actually added to library
  rejection_reasons JSONB, -- why certain suggestions were rejected
  candidates_analyzed INTEGER DEFAULT 0,
  terms_added INTEGER DEFAULT 0,
  synonyms_added INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_by UUID -- user who triggered the search
);

-- Add enrichment metadata to standardization tables
ALTER TABLE public.standard_skills 
ADD COLUMN source TEXT DEFAULT 'manual', -- 'manual', 'enriched', 'ai_suggested'
ADD COLUMN confidence_score NUMERIC DEFAULT 1.0,
ADD COLUMN usage_count INTEGER DEFAULT 0,
ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE DEFAULT now();

ALTER TABLE public.standard_job_titles 
ADD COLUMN source TEXT DEFAULT 'manual',
ADD COLUMN confidence_score NUMERIC DEFAULT 1.0,
ADD COLUMN usage_count INTEGER DEFAULT 0,
ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE DEFAULT now();

ALTER TABLE public.standard_locations 
ADD COLUMN source TEXT DEFAULT 'manual',
ADD COLUMN confidence_score NUMERIC DEFAULT 1.0,
ADD COLUMN usage_count INTEGER DEFAULT 0,
ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Enable RLS for enrichment logs
ALTER TABLE public.library_enrichment_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for enrichment logs
CREATE POLICY "Organization members can view enrichment logs for their searches" 
ON public.library_enrichment_logs FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM members m 
    WHERE m.user_id = auth.uid() 
    AND m.user_status = 'active'
  )
);

CREATE POLICY "Platform admins can manage all enrichment logs" 
ON public.library_enrichment_logs FOR ALL 
USING (get_user_type_secure() = 'platform_admin');

-- Create indexes for performance
CREATE INDEX idx_library_enrichment_logs_type ON public.library_enrichment_logs(enrichment_type);
CREATE INDEX idx_library_enrichment_logs_created_at ON public.library_enrichment_logs(created_at);
CREATE INDEX idx_standard_skills_source ON public.standard_skills(source);
CREATE INDEX idx_standard_skills_usage_count ON public.standard_skills(usage_count DESC);

-- Function to increment usage count when terms are used
CREATE OR REPLACE FUNCTION increment_term_usage(table_name TEXT, term_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF table_name = 'skills' THEN
    UPDATE public.standard_skills 
    SET usage_count = usage_count + 1, last_seen = now()
    WHERE canonical_name = term_name;
  ELSIF table_name = 'job_titles' THEN
    UPDATE public.standard_job_titles 
    SET usage_count = usage_count + 1, last_seen = now()
    WHERE canonical_title = term_name;
  ELSIF table_name = 'locations' THEN
    UPDATE public.standard_locations 
    SET usage_count = usage_count + 1, last_seen = now()
    WHERE canonical_name = term_name;
  END IF;
END;
$$;