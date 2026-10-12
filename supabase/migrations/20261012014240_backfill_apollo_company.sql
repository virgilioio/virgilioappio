-- Apollo collects without a current company (2026-10-12).
--
-- Apollo's enrichment moved the company from organization_name to
-- organization.name, so Collect saved 235 people with no current company.
-- Their work history has it: fill company_current from the current job.
-- Only empty values are filled; nothing a person typed is touched.

update public.candidates c
set company_current = w.company_name
from (
  select distinct on (cwe.candidate_id) cwe.candidate_id, trim(cwe.company_name) as company_name
  from public.candidate_work_experience cwe
  where cwe.is_current
    and nullif(trim(cwe.company_name), '') is not null
    and cwe.company_name <> 'Unknown Company'
  order by cwe.candidate_id, cwe.start_date desc nulls last
) w
where w.candidate_id = c.id
  and c.source = 'apollo'
  and c.company_current is null
  and c.deleted_at is null
  and c.merged_into is null;
