-- Create standardization library tables
CREATE TABLE public.standard_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL UNIQUE,
  category TEXT,
  parent_skill TEXT,
  synonyms TEXT[] DEFAULT '{}',
  esco_code TEXT,
  onet_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.standard_job_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_title TEXT NOT NULL UNIQUE,
  category TEXT,
  onet_code TEXT,
  synonyms TEXT[] DEFAULT '{}',
  seniority_level TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.standard_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL UNIQUE,
  country_code TEXT,
  region TEXT,
  city TEXT,
  synonyms TEXT[] DEFAULT '{}',
  is_remote BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add standardized fields to jobs table
ALTER TABLE public.jobs 
ADD COLUMN standardized_skills TEXT[],
ADD COLUMN standardized_title TEXT,
ADD COLUMN standardized_location TEXT,
ADD COLUMN normalization_metadata JSONB DEFAULT '{}';

-- Enable RLS
ALTER TABLE public.standard_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_job_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_locations ENABLE ROW LEVEL SECURITY;

-- RLS policies - readable by all authenticated users, manageable by platform admins
CREATE POLICY "Everyone can view standard skills" ON public.standard_skills FOR SELECT USING (true);
CREATE POLICY "Platform admins can manage standard skills" ON public.standard_skills FOR ALL USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Everyone can view standard job titles" ON public.standard_job_titles FOR SELECT USING (true);
CREATE POLICY "Platform admins can manage standard job titles" ON public.standard_job_titles FOR ALL USING (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Everyone can view standard locations" ON public.standard_locations FOR SELECT USING (true);
CREATE POLICY "Platform admins can manage standard locations" ON public.standard_locations FOR ALL USING (get_user_type_secure() = 'platform_admin');

-- Insert sample standardization data
INSERT INTO public.standard_skills (canonical_name, category, synonyms) VALUES
('B2B Sales', 'Sales', '{"business-to-business sales", "enterprise sales", "corporate sales", "commercial sales"}'),
('Sales Development', 'Sales', '{"business development", "lead generation", "prospecting", "outbound sales"}'),
('Account Management', 'Sales', '{"client management", "customer success", "relationship management"}'),
('JavaScript', 'Technology', '{"JS", "ECMAScript", "Node.js development"}'),
('React', 'Technology', '{"ReactJS", "React.js", "Frontend React"}'),
('Python', 'Technology', '{"Python programming", "Python development", "Python scripting"}'),
('Project Management', 'Management', '{"PM", "program management", "project coordination"}'),
('Data Analysis', 'Analytics', '{"data analytics", "business intelligence", "statistical analysis"}');

INSERT INTO public.standard_job_titles (canonical_title, category, synonyms, seniority_level) VALUES
('Sales Development Representative', 'Sales', '{"SDR", "Sales Dev Rep", "Business Development Representative", "BDR", "Lead Generation Specialist"}', 'Entry'),
('Account Executive', 'Sales', '{"AE", "Sales Executive", "Enterprise Sales Rep", "Senior Sales Rep"}', 'Mid'),
('Sales Manager', 'Sales', '{"Regional Sales Manager", "Area Sales Manager", "Sales Team Lead"}', 'Senior'),
('Software Engineer', 'Technology', '{"Developer", "Programmer", "Software Developer", "SWE"}', 'Mid'),
('Senior Software Engineer', 'Technology', '{"Senior Developer", "Lead Developer", "Sr. SWE"}', 'Senior'),
('Product Manager', 'Product', '{"PM", "Product Owner", "Product Lead"}', 'Mid'),
('Data Scientist', 'Analytics', '{"ML Engineer", "Data Analyst", "Research Scientist"}', 'Mid');

INSERT INTO public.standard_locations (canonical_name, country_code, synonyms, is_remote) VALUES
('United States', 'US', '{"USA", "America", "U.S.", "U.S.A."}', false),
('Remote', '', '{"Work from home", "WFH", "Distributed", "Anywhere", "Virtual"}', true),
('New York', 'US', '{"NYC", "New York City", "Manhattan"}', false),
('San Francisco', 'US', '{"SF", "Bay Area", "Silicon Valley"}', false),
('London', 'GB', '{"London, UK", "Greater London"}', false),
('Canada', 'CA', '{"Canadian", "CA"}', false);

-- Create indexes for performance
CREATE INDEX idx_standard_skills_synonyms ON public.standard_skills USING GIN(synonyms);
CREATE INDEX idx_standard_job_titles_synonyms ON public.standard_job_titles USING GIN(synonyms);
CREATE INDEX idx_standard_locations_synonyms ON public.standard_locations USING GIN(synonyms);

-- Add updated_at trigger
CREATE TRIGGER update_standard_skills_updated_at
  BEFORE UPDATE ON public.standard_skills
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_standard_job_titles_updated_at
  BEFORE UPDATE ON public.standard_job_titles
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_standard_locations_updated_at
  BEFORE UPDATE ON public.standard_locations
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();