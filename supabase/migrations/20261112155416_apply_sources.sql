-- Where applications come from (job exposure, Phase 1; Allan, Go! 2026-11-12).
--
-- Every application through a careers page has said "public_posting", so nobody could
-- tell a LinkedIn post from a Jooble listing. Now the application itself records where
-- the applicant came from:
--   applied_via         a channel key from _shared/applySource.ts (linkedin, whatsapp,
--                       google, jooble, careers, other, ...), written only by
--                       public-submit-application from the posting link's ?src= / ?source=
--                       / utm tags and the page that sent them.
--   applied_via_detail  what that was read from: utm tags, the sending site's host, who
--                       shared the link (a teammate's user id, or "the client's team").
-- Older applications stay null (read as "Not tracked").
--
-- Share codes: the share kit's links carry ?by=<code> so an application can say which
-- teammate's post it came from without a user id in the address. One code per person,
-- made on first use by posting_share_code(); people read only their own.

alter table public.job_candidate_associations
  add column if not exists applied_via text,
  add column if not exists applied_via_detail jsonb;

alter table public.job_candidate_associations
  add constraint jca_applied_via_key
  check (applied_via is null or applied_via ~ '^[a-z][a-z0-9_]{1,31}$');

comment on column public.job_candidate_associations.applied_via is
  'Where an application came from: a channel key from _shared/applySource.ts, set by public-submit-application. Null before 2026-11-12 or when added by the team.';
comment on column public.job_candidate_associations.applied_via_detail is
  'What applied_via was read from: utm_source, utm_medium, utm_campaign, referrer_host, shared_by (user id), by_client.';

create table if not exists public.posting_share_codes (
  user_id uuid primary key,
  code text not null unique check (code ~ '^[a-z0-9]{8}$'),
  created_at timestamptz not null default now()
);

alter table public.posting_share_codes enable row level security;

create policy posting_share_codes_own on public.posting_share_codes
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.posting_share_codes from anon;
revoke all on public.posting_share_codes from authenticated;
grant select on public.posting_share_codes to authenticated;

comment on table public.posting_share_codes is
  'One short code per person for the share kit''s links (?by=). Made by posting_share_code(), read back by public-submit-application to credit a teammate''s post.';

create or replace function public.posting_share_code()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to share this job.' using errcode = 'GSH01';
  end if;

  select code into v_code from public.posting_share_codes where user_id = auth.uid();
  if v_code is not null then
    return v_code;
  end if;

  loop
    v_code := substr(md5(gen_random_uuid()::text), 1, 8);
    begin
      insert into public.posting_share_codes (user_id, code)
      values (auth.uid(), v_code)
      on conflict (user_id) do nothing;
      exit;
    exception when unique_violation then
      -- Another person already has this code: draw again.
      null;
    end;
  end loop;

  select code into v_code from public.posting_share_codes where user_id = auth.uid();
  return v_code;
end;
$function$;

revoke all on function public.posting_share_code() from public;
revoke all on function public.posting_share_code() from anon;
grant execute on function public.posting_share_code() to authenticated;

comment on function public.posting_share_code() is
  'The caller''s share code for the share kit''s links, made on first use (GSH01 when nobody is signed in).';
