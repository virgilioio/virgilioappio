-- Move the candidates Allan sourced in the Motive workspace into Virgilio's
-- (Allan, 2026-10-11/12: his own sourcing, done in a workspace he set up to
-- try Gio ATS; no "from Motive" tag).
--
-- Each live Motive candidate goes through find_candidate_matches() against
-- Virgilio's candidates, exactly like any other way in:
-- - a strong match with nothing contradicting it (same Apollo id, LinkedIn
--   or email) fills only what Virgilio's record is missing, and their work
--   history, education and certifications are added when Virgilio's record
--   has none; files are added as extra files (Virgilio's resume stays);
-- - anyone else becomes a new Virgilio candidate with their profile, salary
--   expectations, work history, education, certifications and files.
-- Notes, pipelines and scorecards belong to Motive's jobs and stay there.
-- The Motive records are left as they are. candidate_transfers records
-- which record became which.

create table if not exists public.candidate_transfers (
  source_candidate_id uuid primary key,
  target_candidate_id uuid not null,
  target_tenant_id uuid not null,
  merged boolean not null,
  transferred_at timestamptz not null default now()
);

comment on table public.candidate_transfers is
  'Candidates copied from one workspace into another, and the record each became (merged = filled an existing one).';

alter table public.candidate_transfers enable row level security;

create policy "Workspace members read transfers into their workspace"
  on public.candidate_transfers for select to authenticated
  using (public.user_has_tenant_access(target_tenant_id));

grant select on public.candidate_transfers to authenticated;
grant all on public.candidate_transfers to service_role;

do $move$
declare
  v_from constant uuid := '90e2f4fe-7c51-4eab-bb15-a883fdeb5b5a';  -- Motive
  v_to constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';    -- Virgilio
  v_org constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';   -- Virgilio's root organization
  v_owner constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de'; -- Allan in Virgilio
  r public.candidates;
  v_match uuid;
  v_target uuid;
  v_apollo text;
  v_has_resume boolean;
begin
  for r in
    select * from public.candidates c
    where c.tenant_id = v_from and c.deleted_at is null and c.merged_into is null
      and not exists (select 1 from public.candidate_transfers t where t.source_candidate_id = c.id)
    order by c.created_at
  loop
    select m.candidate_id into v_match
    from public.find_candidate_matches(v_to, jsonb_build_object(
      'candidate_name', r.candidate_name,
      'email', coalesce(r.email, r.contact_email),
      'phone', coalesce(r.phone, r.contact_phone),
      'linkedin_url', r.linkedin_url,
      'apollo_id', r.apollo_id,
      'company_current', r.company_current)) m
    where m.strength = 'strong' and not m.conflict
    limit 1;

    -- Same email and same name is one person even when a LinkedIn link
    -- differs (and the workspace allows only one such record).
    if v_match is null and r.email is not null then
      select coalesce(x.merged_into, x.id) into v_match
      from public.candidates x
      where x.tenant_id = v_to and x.email = r.email and x.candidate_name = r.candidate_name
        and x.deleted_at is null
      limit 1;
    end if;

    -- An Apollo id another Virgilio record already holds stays where it is.
    v_apollo := case when r.apollo_id is not null and not exists (
        select 1 from public.candidates x
        where x.tenant_id = v_to and x.apollo_id = r.apollo_id
          and x.deleted_at is null and x.merged_into is null)
      then r.apollo_id end;

    if v_match is not null then
      v_target := v_match;
      update public.candidates t set
        email             = coalesce(nullif(t.email, ''), r.email),
        phone             = coalesce(nullif(t.phone, ''), r.phone),
        linkedin_url      = coalesce(nullif(t.linkedin_url, ''), r.linkedin_url),
        location_country  = coalesce(nullif(t.location_country, ''), r.location_country),
        location_state    = coalesce(nullif(t.location_state, ''), r.location_state),
        location_city     = coalesce(nullif(t.location_city, ''), r.location_city),
        salary_amount     = coalesce(t.salary_amount, r.salary_amount),
        salary_currency   = coalesce(nullif(t.salary_currency, ''), r.salary_currency),
        salary_period     = coalesce(nullif(t.salary_period, ''), r.salary_period),
        profile_summary   = coalesce(nullif(t.profile_summary, ''), r.profile_summary),
        resume_url        = coalesce(nullif(t.resume_url, ''), r.resume_url),
        skills            = case when coalesce(cardinality(t.skills), 0) = 0 then r.skills else t.skills end,
        bio               = coalesce(nullif(t.bio, ''), r.bio),
        company_current   = coalesce(nullif(t.company_current, ''), r.company_current),
        role_current      = coalesce(nullif(t.role_current, ''), r.role_current),
        current_job_title = coalesce(nullif(t.current_job_title, ''), r.current_job_title),
        years_experience  = coalesce(t.years_experience, r.years_experience),
        seniority_level   = coalesce(nullif(t.seniority_level, ''), r.seniority_level),
        contact_emails    = case when coalesce(cardinality(t.contact_emails), 0) = 0 then r.contact_emails else t.contact_emails end,
        contact_phones    = case when coalesce(cardinality(t.contact_phones), 0) = 0 then r.contact_phones else t.contact_phones end,
        apollo_id         = coalesce(t.apollo_id, v_apollo),
        apollo_collected_at = coalesce(t.apollo_collected_at, r.apollo_collected_at)
      where t.id = v_target;

      if not exists (select 1 from public.candidate_work_experience w where w.candidate_id = v_target) then
        insert into public.candidate_work_experience
          (candidate_id, company_name, company_logo_url, job_title, start_date, end_date, is_current, description,
           skills_used, location, standardized_title, company_industry, company_size_category, duration_months)
        select v_target, company_name, company_logo_url, job_title, start_date, end_date, is_current, description,
           skills_used, location, standardized_title, company_industry, company_size_category, duration_months
        from public.candidate_work_experience where candidate_id = r.id;
      end if;
      if not exists (select 1 from public.candidate_education e where e.candidate_id = v_target) then
        insert into public.candidate_education
          (candidate_id, institution_name, degree_type, field_of_study, start_date, end_date, grade, description, education_level)
        select v_target, institution_name, degree_type, field_of_study, start_date, end_date, grade, description, education_level
        from public.candidate_education where candidate_id = r.id;
      end if;
      if not exists (select 1 from public.candidate_certifications e where e.candidate_id = v_target) then
        insert into public.candidate_certifications
          (candidate_id, certification_name, issuing_organization, year_obtained, is_bootcamp)
        select v_target, certification_name, issuing_organization, year_obtained, is_bootcamp
        from public.candidate_certifications where candidate_id = r.id;
      end if;
    else
      insert into public.candidates (
        candidate_name, email, phone, location_country, location_state, location_city,
        salary_amount, salary_currency, salary_period, profile_summary, linkedin_url, resume_url,
        skills, status, source, created_at, created_by, skills_metadata, auto_generated_skills,
        last_skills_generation, enrichment_status, enriched_at, contact_emails, contact_phones,
        social_profiles, bio, company_current, role_current, years_experience, resume_generated_url,
        standardized_skills, organization_id, coresignal_profile_id, coresignal_search_score,
        coresignal_collected_at, coresignal_headline, coresignal_connections_count, tenant_id,
        job_board_source, external_application_id, apollo_id, apollo_collected_at, contact_email,
        contact_phone, email_status, current_job_title, standardized_title, seniority_level,
        functional_area, specialization, years_in_specialization, years_in_leadership,
        company_count, avg_tenure_months)
      values (
        r.candidate_name,
        -- a removed Virgilio record with this email and name holds the pair
        case when exists (select 1 from public.candidates x
                          where x.tenant_id = v_to and x.email = r.email and x.candidate_name = r.candidate_name)
             then null else r.email end,
        r.phone, r.location_country, r.location_state, r.location_city,
        r.salary_amount, r.salary_currency, r.salary_period, r.profile_summary, r.linkedin_url, r.resume_url,
        r.skills,
        case when r.status in ('active', 'available', 'new', 'inactive') then r.status else 'available' end,
        r.source, r.created_at, v_owner, r.skills_metadata, r.auto_generated_skills,
        r.last_skills_generation, r.enrichment_status, r.enriched_at, r.contact_emails, r.contact_phones,
        r.social_profiles, r.bio, r.company_current, r.role_current, r.years_experience, r.resume_generated_url,
        r.standardized_skills, v_org, r.coresignal_profile_id, r.coresignal_search_score,
        r.coresignal_collected_at, r.coresignal_headline, r.coresignal_connections_count, v_to,
        r.job_board_source, r.external_application_id, v_apollo, r.apollo_collected_at, r.contact_email,
        r.contact_phone, r.email_status, r.current_job_title, r.standardized_title, r.seniority_level,
        r.functional_area, r.specialization, r.years_in_specialization, r.years_in_leadership,
        r.company_count, r.avg_tenure_months)
      returning id into v_target;

      insert into public.candidate_work_experience
        (candidate_id, company_name, company_logo_url, job_title, start_date, end_date, is_current, description,
         skills_used, location, standardized_title, company_industry, company_size_category, duration_months)
      select v_target, company_name, company_logo_url, job_title, start_date, end_date, is_current, description,
         skills_used, location, standardized_title, company_industry, company_size_category, duration_months
      from public.candidate_work_experience where candidate_id = r.id;

      insert into public.candidate_education
        (candidate_id, institution_name, degree_type, field_of_study, start_date, end_date, grade, description, education_level)
      select v_target, institution_name, degree_type, field_of_study, start_date, end_date, grade, description, education_level
      from public.candidate_education where candidate_id = r.id;

      insert into public.candidate_certifications
        (candidate_id, certification_name, issuing_organization, year_obtained, is_bootcamp)
      select v_target, certification_name, issuing_organization, year_obtained, is_bootcamp
      from public.candidate_certifications where candidate_id = r.id;
    end if;

    -- Files: the same stored file, now also listed on the Virgilio record.
    -- A record that already has a resume keeps it; Motive's come as files.
    select exists (
      select 1 from public.candidate_attachments a where a.candidate_id = v_target and a.is_resume
    ) into v_has_resume;
    insert into public.candidate_attachments
      (candidate_id, file_name, file_url, file_size_bytes, file_type, uploaded_by, created_at,
       is_resume, converted_pdf_url, conversion_status, converted_at, version)
    select v_target, a.file_name, a.file_url, a.file_size_bytes, a.file_type, v_owner, a.created_at,
       case when v_has_resume then false else a.is_resume end,
       a.converted_pdf_url, a.conversion_status, a.converted_at, a.version
    from public.candidate_attachments a
    where a.candidate_id = r.id
      and a.superseded_by is null
      and not exists (
        select 1 from public.candidate_attachments x
        where x.candidate_id = v_target and x.file_url = a.file_url)
    order by a.is_resume, a.created_at;

    insert into public.candidate_transfers (source_candidate_id, target_candidate_id, target_tenant_id, merged)
    values (r.id, v_target, v_to, v_match is not null);
  end loop;
end
$move$;
