
-- Check existing policies and drop them more comprehensively
DO $$ 
DECLARE
    rec RECORD;
BEGIN
    -- Drop all existing policies on organizations
    FOR rec IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'organizations' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || rec.policyname || '" ON organizations';
    END LOOP;
    
    -- Drop all existing policies on members
    FOR rec IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'members' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || rec.policyname || '" ON members';
    END LOOP;
    
    -- Drop all existing policies on jobs
    FOR rec IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'jobs' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || rec.policyname || '" ON jobs';
    END LOOP;
    
    -- Drop all existing policies on job_candidates
    FOR rec IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'job_candidates' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || rec.policyname || '" ON job_candidates';
    END LOOP;
    
    -- Drop all existing policies on invoices
    FOR rec IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'invoices' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || rec.policyname || '" ON invoices';
    END LOOP;
    
    -- Drop all existing policies on job_requests
    FOR rec IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'job_requests' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || rec.policyname || '" ON job_requests';
    END LOOP;
    
    -- Drop all existing policies on candidate_comments
    FOR rec IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'candidate_comments' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || rec.policyname || '" ON candidate_comments';
    END LOOP;
END $$;

-- Ensure RLS is enabled on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_comments ENABLE ROW LEVEL SECURITY;

-- ORGANIZATIONS TABLE POLICIES
CREATE POLICY "organizations_select_policy" ON organizations
FOR SELECT USING (
  get_user_type() = 'platform_admin'
  OR id = get_user_organization_id()
);

CREATE POLICY "organizations_insert_policy" ON organizations
FOR INSERT WITH CHECK (
  get_user_type() = 'platform_admin'
);

CREATE POLICY "organizations_update_policy" ON organizations
FOR UPDATE USING (
  get_user_type() = 'platform_admin'
  OR id = get_user_organization_id()
);

CREATE POLICY "organizations_delete_policy" ON organizations
FOR DELETE USING (
  get_user_type() = 'platform_admin'
);

-- MEMBERS TABLE POLICIES
CREATE POLICY "members_select_policy" ON members
FOR SELECT USING (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

CREATE POLICY "members_insert_policy" ON members
FOR INSERT WITH CHECK (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

CREATE POLICY "members_update_policy" ON members
FOR UPDATE USING (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

CREATE POLICY "members_delete_policy" ON members
FOR DELETE USING (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

-- JOBS TABLE POLICIES
CREATE POLICY "jobs_select_policy" ON jobs
FOR SELECT USING (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

CREATE POLICY "jobs_insert_policy" ON jobs
FOR INSERT WITH CHECK (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

CREATE POLICY "jobs_update_policy" ON jobs
FOR UPDATE USING (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

CREATE POLICY "jobs_delete_policy" ON jobs
FOR DELETE USING (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

-- JOB_CANDIDATES TABLE POLICIES
CREATE POLICY "job_candidates_select_policy" ON job_candidates
FOR SELECT USING (
  get_user_type() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_candidates.job_id 
    AND jobs.organization_id = get_user_organization_id()
  )
);

CREATE POLICY "job_candidates_insert_policy" ON job_candidates
FOR INSERT WITH CHECK (
  get_user_type() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_candidates.job_id 
    AND jobs.organization_id = get_user_organization_id()
  )
);

CREATE POLICY "job_candidates_update_policy" ON job_candidates
FOR UPDATE USING (
  get_user_type() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_candidates.job_id 
    AND jobs.organization_id = get_user_organization_id()
  )
);

CREATE POLICY "job_candidates_delete_policy" ON job_candidates
FOR DELETE USING (
  get_user_type() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_candidates.job_id 
    AND jobs.organization_id = get_user_organization_id()
  )
);

-- INVOICES TABLE POLICIES
CREATE POLICY "invoices_select_policy" ON invoices
FOR SELECT USING (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

CREATE POLICY "invoices_insert_policy" ON invoices
FOR INSERT WITH CHECK (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

CREATE POLICY "invoices_update_policy" ON invoices
FOR UPDATE USING (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

CREATE POLICY "invoices_delete_policy" ON invoices
FOR DELETE USING (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

-- JOB_REQUESTS TABLE POLICIES
CREATE POLICY "job_requests_select_policy" ON job_requests
FOR SELECT USING (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

CREATE POLICY "job_requests_insert_policy" ON job_requests
FOR INSERT WITH CHECK (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

CREATE POLICY "job_requests_update_policy" ON job_requests
FOR UPDATE USING (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

CREATE POLICY "job_requests_delete_policy" ON job_requests
FOR DELETE USING (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

-- CANDIDATE_COMMENTS TABLE POLICIES
CREATE POLICY "candidate_comments_select_policy" ON candidate_comments
FOR SELECT USING (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

CREATE POLICY "candidate_comments_insert_policy" ON candidate_comments
FOR INSERT WITH CHECK (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
);

CREATE POLICY "candidate_comments_update_policy" ON candidate_comments
FOR UPDATE USING (
  get_user_type() = 'platform_admin'
  OR (organization_id = get_user_organization_id() AND author_id = auth.uid())
);

CREATE POLICY "candidate_comments_delete_policy" ON candidate_comments
FOR DELETE USING (
  get_user_type() = 'platform_admin'
  OR (organization_id = get_user_organization_id() AND author_id = auth.uid())
);
