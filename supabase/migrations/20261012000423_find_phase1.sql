-- Find, Phase 1 (2026-10-11, approved by Allan): one identity per person and
-- a real search over our own candidates.
--
-- 1. Normalisers for the keys a person is known by (email, phone, name).
-- 2. person_identities: every key a candidate has ever had (Apollo id,
--    LinkedIn profile, email, phone), kept in step with candidates by a
--    trigger and moved to the surviving record on a merge. Backfilled.
-- 3. find_candidate_matches(): the one function every way a candidate
--    enters (collect, application, manual add, extension, import) asks
--    before writing. Strong = same Apollo id, LinkedIn or email; medium =
--    same phone and same name; weak = same name and company (suggestion).
-- 4. possible_duplicate_pairs(): pairs already in the database that share a
--    strong key, or a phone and a name, minus "Not the same person"
--    decisions. The Candidates page groups them into a queue.
-- 5. search_candidates(): a project's criteria over our own candidates
--    (titles, keywords, companies, countries, cities, seniority), ranked,
--    so Find can show "Already in Gio" before anything from Apollo.

-- ── 1. Normalisers ─────────────────────────────────────────────────────────

create or replace function public.identity_email(p text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select case when p ~ '^\s*[^@\s]+@[^@\s]+\.[^@\s]+\s*$' then lower(btrim(p)) end
$$;

create or replace function public.identity_phone(p text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select case when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 8
    then right(regexp_replace(p, '\D', '', 'g'), 10) end
$$;

-- Lower-case, accents folded, letters and spaces only, single spaces.
create or replace function public.person_name_key(p text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select nullif(btrim(regexp_replace(regexp_replace(
    translate(lower(coalesce(p, '')),
      'áàäâãåéèëêíìïîóòöôõúùüûñçýÿ', 'aaaaaaeeeeiiiiooooouuuuncyy'),
    '[^a-z ]', ' ', 'g'), '\s+', ' ', 'g')), '')
$$;

-- Two names are the same person's when they're equal, or share the first
-- and the last word ("Ana Sofia Perez" / "Ana Perez").
create or replace function public.person_names_match(a text, b text)
returns boolean language sql immutable parallel safe set search_path = '' as $$
  select case
    when public.person_name_key(a) is null or public.person_name_key(b) is null then false
    when public.person_name_key(a) = public.person_name_key(b) then true
    else split_part(public.person_name_key(a), ' ', 1) = split_part(public.person_name_key(b), ' ', 1)
     and regexp_replace(public.person_name_key(a), '^.* ', '') = regexp_replace(public.person_name_key(b), '^.* ', '')
     and position(' ' in public.person_name_key(a)) > 0
     and position(' ' in public.person_name_key(b)) > 0
  end
$$;

-- contact_emails / contact_phones hold JSON objects as text, or plain values.
create or replace function public.contact_value(p_elem text, p_key text)
returns text language plpgsql immutable parallel safe set search_path = '' as $$
begin
  if p_elem is null then return null; end if;
  if left(btrim(p_elem), 1) = '{' then
    begin
      return (p_elem::jsonb) ->> p_key;
    exception when others then
      return null;
    end;
  end if;
  return p_elem;
end
$$;

-- ── 2. Identities ──────────────────────────────────────────────────────────

create table if not exists public.person_identities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  candidate_id uuid not null,
  kind text not null check (kind in ('apollo', 'linkedin', 'email', 'phone', 'pdl')),
  value text not null check (char_length(value) between 1 and 320),
  created_at timestamptz not null default now()
);

comment on table public.person_identities is
  'Every key a candidate has had (Apollo id, LinkedIn slug, email, phone), normalised, so a match can use any of them. Kept by candidates_identities_sync; moved to the survivor on a merge. Server-written only.';

create unique index if not exists person_identities_key
  on public.person_identities (tenant_id, kind, value, candidate_id);
create index if not exists person_identities_candidate_idx
  on public.person_identities (candidate_id);

alter table public.person_identities enable row level security;

create policy "Workspace members read identities"
  on public.person_identities for select to authenticated
  using (public.user_has_tenant_access(tenant_id));

grant select on public.person_identities to authenticated;
grant all on public.person_identities to service_role;

-- The keys of one candidate row, normalised.
create or replace function public.candidate_identity_keys(c public.candidates)
returns table (kind text, value text)
language sql stable set search_path = '' as $$
  select k.kind, k.value from (
    select 'apollo'::text as kind, nullif(btrim(c.apollo_id), '') as value
    union all select 'linkedin', public.linkedin_slug(c.linkedin_url)
    union all select 'email', public.identity_email(c.email)
    union all select 'email', public.identity_email(c.contact_email)
    union all select 'phone', public.identity_phone(c.phone)
    union all select 'phone', public.identity_phone(c.contact_phone)
    union all select 'email', public.identity_email(public.contact_value(e, 'email'))
      from unnest(coalesce(c.contact_emails, array[]::text[])) e
    union all select 'phone', public.identity_phone(public.contact_value(p, 'number'))
      from unnest(coalesce(c.contact_phones, array[]::text[])) p
  ) k
  where k.value is not null
$$;

create or replace function public.candidates_identities_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tenant_id is null then
    return null;
  end if;

  -- Merged into another record: its keys, project rows and Apollo id move
  -- to the survivor, so every later match lands on one person.
  if new.merged_into is not null and (tg_op = 'INSERT' or old.merged_into is null) then
    insert into public.person_identities (tenant_id, candidate_id, kind, value)
    select pi.tenant_id, new.merged_into, pi.kind, pi.value
    from public.person_identities pi
    where pi.candidate_id = new.id
    on conflict do nothing;

    update public.sourcing_project_candidates spc
       set candidate_id = new.merged_into
     where spc.candidate_id = new.id
       and not exists (
         select 1 from public.sourcing_project_candidates o
         where o.sourcing_project_id = spc.sourcing_project_id and o.candidate_id = new.merged_into);

    if new.apollo_id is not null then
      update public.candidates s
         set apollo_id = new.apollo_id
       where s.id = new.merged_into and s.apollo_id is null;
    end if;
    return null;
  end if;

  if new.deleted_at is not null or new.merged_into is not null then
    return null;
  end if;

  insert into public.person_identities (tenant_id, candidate_id, kind, value)
  select new.tenant_id, new.id, k.kind, k.value
  from public.candidate_identity_keys(new) k
  on conflict do nothing;
  return null;
end
$$;

create or replace trigger candidates_identities_sync
  after insert or update of apollo_id, linkedin_url, email, phone, contact_email, contact_phone,
    contact_emails, contact_phones, merged_into, tenant_id
  on public.candidates
  for each row execute function public.candidates_identities_sync();

-- Backfill: every live candidate's keys.
insert into public.person_identities (tenant_id, candidate_id, kind, value)
select c.tenant_id, c.id, k.kind, k.value
from public.candidates c
cross join lateral public.candidate_identity_keys(c) k
where c.tenant_id is not null and c.deleted_at is null and c.merged_into is null
on conflict do nothing;

create index if not exists candidates_tenant_name_key_idx
  on public.candidates (tenant_id, public.person_name_key(candidate_name));

-- ── 3. The match finder ────────────────────────────────────────────────────

create or replace function public.find_candidate_matches(
  p_tenant uuid,
  p_payload jsonb,
  p_exclude uuid default null
)
returns table (
  candidate_id uuid,
  strength text,
  reasons text[],
  conflict boolean,
  conflict_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_apollo text := nullif(btrim(p_payload ->> 'apollo_id'), '');
  v_li text := public.linkedin_slug(p_payload ->> 'linkedin_url');
  v_email text := public.identity_email(p_payload ->> 'email');
  v_phone text := public.identity_phone(p_payload ->> 'phone');
  v_name text := p_payload ->> 'candidate_name';
  v_company text := public.person_name_key(coalesce(p_payload ->> 'company_current', p_payload ->> 'current_company'));
begin
  if auth.uid() is not null and not public.user_has_tenant_access(p_tenant) then
    raise exception 'No access to this workspace' using errcode = '42501';
  end if;

  return query
  with hits as (
    select pi.candidate_id as cid, pi.kind
    from public.person_identities pi
    where pi.tenant_id = p_tenant
      and ((pi.kind = 'apollo' and pi.value = v_apollo)
        or (pi.kind = 'linkedin' and pi.value = v_li)
        or (pi.kind = 'email' and pi.value = v_email)
        or (pi.kind = 'phone' and pi.value = v_phone))
    union
    select c.id, 'name_company'
    from public.candidates c
    where v_company is not null and public.person_name_key(v_name) is not null
      and c.tenant_id = p_tenant
      and public.person_name_key(c.candidate_name) = public.person_name_key(v_name)
      and public.person_name_key(c.company_current) = v_company
  ),
  agg as (
    select h.cid, array_agg(distinct h.kind) as kinds from hits h group by h.cid
  ),
  graded as (
    select
      a.cid,
      a.kinds,
      c.candidate_name,
      c.linkedin_url,
      c.apollo_id,
      case
        when a.kinds && array['apollo', 'linkedin', 'email'] then 1
        when 'phone' = any(a.kinds) and public.person_names_match(c.candidate_name, v_name) then 2
        when 'name_company' = any(a.kinds) then 3
        else 4
      end as rank
    from agg a
    join public.candidates c on c.id = a.cid
    where c.deleted_at is null and c.merged_into is null
      and c.id is distinct from p_exclude
  )
  select
    g.cid,
    case g.rank when 1 then 'strong' when 2 then 'medium' else 'weak' end,
    array_remove(array[
      case when 'apollo' = any(g.kinds) then 'Same Apollo id' end,
      case when 'linkedin' = any(g.kinds) then 'Same LinkedIn' end,
      case when 'email' = any(g.kinds) then 'Same email' end,
      case when 'phone' = any(g.kinds) and g.rank = 2 then 'Same phone and name'
           when 'phone' = any(g.kinds) then 'Same phone' end,
      case when 'name_company' = any(g.kinds) then 'Same name and company' end
    ], null),
    (v_li is not null and public.linkedin_slug(g.linkedin_url) is not null and public.linkedin_slug(g.linkedin_url) <> v_li)
      or (v_apollo is not null and g.apollo_id is not null and g.apollo_id <> v_apollo),
    case
      when v_li is not null and public.linkedin_slug(g.linkedin_url) is not null and public.linkedin_slug(g.linkedin_url) <> v_li
        then 'Different LinkedIn'
      when v_apollo is not null and g.apollo_id is not null and g.apollo_id <> v_apollo
        then 'Different Apollo id'
    end
  from graded g
  where g.rank < 4
  order by g.rank, cardinality(g.kinds) desc
  limit 10;
end
$$;

comment on function public.find_candidate_matches(uuid, jsonb, uuid) is
  'Who in the workspace an incoming person already is. strong: same Apollo id, LinkedIn or email (attach without asking unless conflict); medium: same phone and name (ask); weak: same name and company (suggest). conflict: a strong match whose LinkedIn or Apollo id differs (ask).';

revoke all on function public.find_candidate_matches(uuid, jsonb, uuid) from public, anon;
grant execute on function public.find_candidate_matches(uuid, jsonb, uuid) to authenticated, service_role;

-- ── 4. Possible duplicates already in the database ─────────────────────────

create or replace function public.possible_duplicate_pairs(p_tenant uuid)
returns table (
  candidate_a uuid,
  candidate_b uuid,
  strength text,
  reasons text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.user_has_tenant_access(p_tenant) then
    raise exception 'No access to this workspace' using errcode = '42501';
  end if;

  return query
  with pairs as (
    select a.candidate_id as ca, b.candidate_id as cb, array_agg(distinct a.kind) as kinds
    from public.person_identities a
    join public.person_identities b
      on b.tenant_id = a.tenant_id and b.kind = a.kind and b.value = a.value
     and b.candidate_id > a.candidate_id
    where a.tenant_id = p_tenant
    group by a.candidate_id, b.candidate_id
  ),
  live as (
    select p.ca, p.cb, p.kinds, x.candidate_name as na, y.candidate_name as nb
    from pairs p
    join public.candidates x on x.id = p.ca and x.deleted_at is null and x.merged_into is null
    join public.candidates y on y.id = p.cb and y.deleted_at is null and y.merged_into is null
    where not exists (
      select 1 from public.candidate_duplicate_decisions d
      where d.decision = 'not_duplicate'
        and ((d.candidate_id = p.ca and d.other_candidate_id = p.cb)
          or (d.candidate_id = p.cb and d.other_candidate_id = p.ca)))
  )
  select
    l.ca, l.cb,
    case when l.kinds && array['apollo', 'linkedin', 'email'] then 'strong' else 'medium' end,
    array_remove(array[
      case when 'apollo' = any(l.kinds) then 'Same Apollo id' end,
      case when 'linkedin' = any(l.kinds) then 'Same LinkedIn' end,
      case when 'email' = any(l.kinds) then 'Same email' end,
      case when 'phone' = any(l.kinds) then 'Same phone and name' end
    ], null)
  from live l
  where l.kinds && array['apollo', 'linkedin', 'email']
     or ('phone' = any(l.kinds) and public.person_names_match(l.na, l.nb));
end
$$;

comment on function public.possible_duplicate_pairs(uuid) is
  'Pairs of live candidates that share a strong key, or a phone and a name, and that nobody marked "Not the same person". The app groups them into the Possible duplicates queue.';

revoke all on function public.possible_duplicate_pairs(uuid) from public, anon;
grant execute on function public.possible_duplicate_pairs(uuid) to authenticated, service_role;

-- ── 5. Search over our own candidates ──────────────────────────────────────

-- What a candidate's title is, and everything a keyword can match.
create or replace function public.candidate_title_document(p_role text, p_title text, p_standard text)
returns tsvector language sql immutable parallel safe set search_path = '' as $$
  select to_tsvector('simple', coalesce(p_role, '') || ' ' || coalesce(p_title, '') || ' ' || coalesce(p_standard, ''))
$$;

create or replace function public.candidate_search_document(
  p_role text, p_title text, p_standard text, p_bio text, p_company text, p_summary text, p_skills text[]
)
returns tsvector language sql immutable parallel safe set search_path = '' as $$
  select
    setweight(to_tsvector('simple', coalesce(p_role, '') || ' ' || coalesce(p_title, '') || ' ' || coalesce(p_standard, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(p_company, '') || ' ' || coalesce(array_to_string(p_skills, ' '), '')), 'B')
    || setweight(to_tsvector('simple', coalesce(p_bio, '') || ' ' || coalesce(left(p_summary, 4000), '')), 'C')
$$;

create index if not exists candidates_title_document_idx
  on public.candidates using gin (public.candidate_title_document(role_current, current_job_title, standardized_title));

create index if not exists candidates_search_document_idx
  on public.candidates using gin (public.candidate_search_document(
    role_current, current_job_title, standardized_title, bio, company_current, profile_summary, skills));

create or replace function public.search_candidates(
  p_tenant uuid,
  p_titles text[] default null,
  p_keywords text[] default null,
  p_companies text[] default null,
  p_countries text[] default null,
  p_cities text[] default null,
  p_seniorities text[] default null,
  p_limit integer default 300
)
returns table (
  candidate_id uuid,
  score real,
  matched text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_titles tsquery;
  v_keywords tsquery;
  v_companies text[];
  v_countries text[];
  v_cities text[];
begin
  if auth.uid() is not null and not public.user_has_tenant_access(p_tenant) then
    raise exception 'No access to this workspace' using errcode = '42501';
  end if;

  select string_agg('(' || phraseto_tsquery('simple', t)::text || ')', ' | ')::tsquery
    into v_titles
  from unnest(coalesce(p_titles, array[]::text[])) t
  where numnode(phraseto_tsquery('simple', t)) > 0;

  select string_agg('(' || plainto_tsquery('simple', k)::text || ')', ' | ')::tsquery
    into v_keywords
  from unnest(coalesce(p_keywords, array[]::text[])) k
  where numnode(plainto_tsquery('simple', k)) > 0;

  select array_agg(public.person_name_key(x)) into v_companies
  from unnest(coalesce(p_companies, array[]::text[])) x where public.person_name_key(x) is not null;
  select array_agg(public.person_name_key(x)) into v_countries
  from unnest(coalesce(p_countries, array[]::text[])) x where public.person_name_key(x) is not null;
  select array_agg(public.person_name_key(x)) into v_cities
  from unnest(coalesce(p_cities, array[]::text[])) x where public.person_name_key(x) is not null;

  -- Nothing to search on: no rows, rather than the whole database.
  if v_titles is null and v_keywords is null and v_companies is null then
    return;
  end if;

  return query
  select
    c.id,
    (
      coalesce(5 * ts_rank(public.candidate_title_document(c.role_current, c.current_job_title, c.standardized_title), v_titles), 0)
      + coalesce(2 * ts_rank(public.candidate_search_document(c.role_current, c.current_job_title, c.standardized_title, c.bio, c.company_current, c.profile_summary, c.skills), v_keywords), 0)
      + case when v_companies is not null and public.person_name_key(c.company_current) = any(v_companies) then 1.5 else 0 end
      + case when v_countries is not null and public.person_name_key(c.location_country) = any(v_countries) then 0.5 else 0 end
      + case when v_cities is not null and public.person_name_key(c.location_city) = any(v_cities) then 0.5 else 0 end
      + case when p_seniorities is not null and c.seniority_level = any(p_seniorities) then 0.5 else 0 end
    )::real,
    array_remove(array[
      case when v_titles is not null and public.candidate_title_document(c.role_current, c.current_job_title, c.standardized_title) @@ v_titles then 'title' end,
      case when v_keywords is not null and public.candidate_search_document(c.role_current, c.current_job_title, c.standardized_title, c.bio, c.company_current, c.profile_summary, c.skills) @@ v_keywords then 'keywords' end,
      case when v_companies is not null and public.person_name_key(c.company_current) = any(v_companies) then 'company' end,
      case when v_countries is not null and public.person_name_key(c.location_country) = any(v_countries) then 'country' end,
      case when v_cities is not null and public.person_name_key(c.location_city) = any(v_cities) then 'city' end,
      case when p_seniorities is not null and c.seniority_level = any(p_seniorities) then 'seniority' end
    ], null)
  from public.candidates c
  where c.tenant_id = p_tenant
    and c.deleted_at is null
    and c.merged_into is null
    -- A title search needs the title; otherwise keywords or a target company.
    and (
      (v_titles is not null and public.candidate_title_document(c.role_current, c.current_job_title, c.standardized_title) @@ v_titles)
      or (v_titles is null and v_keywords is not null
          and public.candidate_search_document(c.role_current, c.current_job_title, c.standardized_title, c.bio, c.company_current, c.profile_summary, c.skills) @@ v_keywords)
      or (v_companies is not null and public.person_name_key(c.company_current) = any(v_companies))
    )
    -- A country filter keeps people in those countries and people whose
    -- country we don't know.
    and (v_countries is null or c.location_country is null
         or public.person_name_key(c.location_country) = any(v_countries))
  order by 2 desc, c.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
end
$$;

comment on function public.search_candidates(uuid, text[], text[], text[], text[], text[], text[], integer) is
  'Find''s search over the workspace''s own candidates: any of the titles (phrase match on the current title), or keywords, or target companies; countries filter (unknown country kept); cities, seniority, keywords and companies rank. Members and the server only.';

revoke all on function public.search_candidates(uuid, text[], text[], text[], text[], text[], text[], integer) from public, anon;
grant execute on function public.search_candidates(uuid, text[], text[], text[], text[], text[], text[], integer) to authenticated, service_role;
