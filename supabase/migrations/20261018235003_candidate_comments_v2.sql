-- Candidate comments, part 1 (Allan, 2026-10-18). Comments move to a card on
-- both candidate profiles, can be private, and can tag teammates.
--
-- 1. Saving a comment works again. Since May the mention trigger read
--    candidates.first_name / last_name, which don't exist, so every insert into
--    candidate_comments failed.
-- 2. Who sees a comment: everyone who can see the candidate (the candidates
--    RLS decides), unless it's private: then only its author. A comment that
--    tags someone can't be private.
-- 3. A comment may be written outside any job (the standalone profile). That
--    needs job_id to accept null, which is a separate desktop-applied statement
--    (20261019000001_candidate_comments_job_optional); everything here already
--    handles a null job.
-- 4. Tagging: "@[Name](user:<uuid>)" in the text. Only people who can see the
--    candidate are notified (a tag never leaks the candidate to someone who
--    can't open it); editing a comment notifies only the newly tagged.
--    comment_people(candidate) lists who can be tagged.
-- 5. A client's decision on a shared dossier or pipeline link is its own kind
--    of notification (candidate_update), no longer a "mention".

alter table public.candidate_comments add column if not exists is_private boolean not null default false;

alter table public.candidate_comments
  add constraint candidate_comments_private_untagged
  check (not (is_private and content ~ '@\[[^\]]*\]\(user:[0-9a-f-]{36}\)'));

-- Whether a given person can see a candidate: the candidates SELECT policy,
-- written for any user instead of the caller.
create or replace function public.user_can_see_candidate(_user_id uuid, _candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.candidates c
    where c.id = _candidate_id and c.deleted_at is null
      and (
        exists (select 1 from public.members m
                where m.user_id = _user_id and m.user_status = 'active' and m.user_type = 'platform_admin')
        or (
          exists (select 1 from public.members m
                  where m.user_id = _user_id and m.tenant_id = c.tenant_id and m.user_status = 'active')
          and (
            not coalesce((select (t.settings->>'job_based_access')::boolean from public.tenants t where t.id = c.tenant_id), false)
            or exists (select 1 from public.members ma
                       where ma.user_id = _user_id and ma.user_status = 'active' and ma.tenant_id = c.tenant_id
                         and (ma.user_type = 'workspace_owner' or ma.system_role = 'admin'))
            or exists (select 1 from public.job_assignments jx join public.jobs jj on jj.id = jx.job_id
                       where jx.user_id = _user_id and jx.deleted_at is null and jx.role in ('recruiter', 'sourcer')
                         and jj.status in ('draft', 'open') and jj.tenant_id = c.tenant_id)
          )
        )
        or exists (select 1 from public.job_candidate_associations jca
                   join public.job_assignments ja on ja.job_id = jca.job_id
                   where jca.candidate_id = c.id and ja.user_id = _user_id and ja.deleted_at is null)
      )
  );
$$;
revoke execute on function public.user_can_see_candidate(uuid, uuid) from public, anon, authenticated;

-- The people a comment on this candidate can tag: active teammates in the
-- candidate's workspace who can see the candidate, not the caller.
create or replace function public.comment_people(_candidate_id uuid)
returns table (user_id uuid, name text, email text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (m.user_id)
         m.user_id,
         coalesce(nullif(btrim(concat(p.first_name, ' ', p.last_name)), ''), p.email, 'Teammate') as name,
         p.email,
         p.avatar_url
  from public.candidates c
  join public.members m on m.tenant_id = c.tenant_id and m.user_status = 'active'
  left join public.profiles p on p.user_id = m.user_id
  where c.id = _candidate_id
    and public.user_can_see_candidate(auth.uid(), _candidate_id)
    and m.user_id <> auth.uid()
    and public.user_can_see_candidate(m.user_id, _candidate_id)
  order by m.user_id;
$$;
revoke execute on function public.comment_people(uuid) from public, anon;
grant execute on function public.comment_people(uuid) to authenticated;

-- A comment's organization comes from its job, or from the author's
-- membership in the candidate's workspace when it has no job.
create or replace function public.candidate_comments_fill()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.job_id is not null then
    select j.organization_id into new.organization_id from public.jobs j where j.id = new.job_id;
  end if;
  if new.organization_id is null then
    select m.organization_id into new.organization_id
    from public.members m join public.candidates c on c.tenant_id = m.tenant_id
    where c.id = new.candidate_id and m.user_id = new.author_id and m.user_status = 'active'
    order by m.organization_id
    limit 1;
  end if;
  return new;
end $$;
create or replace trigger candidate_comments_fill
  before insert on public.candidate_comments
  for each row execute function public.candidate_comments_fill();

-- Reading and writing comments.
alter policy "Users can view comments for accessible candidates" on public.candidate_comments
  using (
    (not is_private or author_id = (select auth.uid()))
    and exists (
      select 1 from public.candidates c
      join public.members m on m.tenant_id = c.tenant_id
      where c.id = candidate_comments.candidate_id
        and m.user_id = (select auth.uid()) and m.user_status = 'active'
        and m.system_role = any (array['admin'::system_role, 'member'::system_role])
    )
  );
alter policy "Users can create comments for accessible candidates" on public.candidate_comments
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.candidates c
      join public.members m on m.tenant_id = c.tenant_id
      where c.id = candidate_comments.candidate_id
        and m.user_id = (select auth.uid()) and m.user_status = 'active'
        and m.system_role = any (array['admin'::system_role, 'member'::system_role])
    )
    and (job_id is null or exists (select 1 from public.jobs j where j.id = candidate_comments.job_id))
  );

-- Tagged people hear about it (only the newly tagged on an edit).
create or replace function public.tg_notify_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uuid text;
  v_recipient uuid;
  v_cand record;
  v_job_title text;
  v_actor_name text;
  v_actor_avatar text;
  v_preview text;
  v_old uuid[] := '{}';
  v_link text;
begin
  if new.is_private then return new; end if;
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(distinct (m)[1]::uuid), '{}') into v_old
    from regexp_matches(coalesce(old.content, ''), '@\[[^\]]*\]\(user:([0-9a-f-]{36})\)', 'g') m;
  end if;

  select c.id, c.candidate_name, c.tenant_id into v_cand from public.candidates c where c.id = new.candidate_id;
  if v_cand.id is null then return new; end if;
  select j.title into v_job_title from public.jobs j where j.id = new.job_id;

  select coalesce(nullif(btrim(concat(p.first_name, ' ', p.last_name)), ''), nullif(new.author_email, ''), 'Someone'), p.avatar_url
    into v_actor_name, v_actor_avatar
    from public.profiles p where p.user_id = new.author_id;
  v_actor_name := coalesce(v_actor_name, nullif(new.author_email, ''), 'Someone');

  -- "@[Priya Raman](user:...)" reads "@Priya Raman" in the preview.
  v_preview := left(regexp_replace(new.content, '@\[([^\]]*)\]\(user:[0-9a-f-]{36}\)', '@\1', 'g'), 280);
  v_link := case when new.job_id is not null
    then '/jobs/' || new.job_id::text || '/candidates/' || new.candidate_id::text
    else '/candidates/' || new.candidate_id::text end;

  for v_uuid in
    select distinct (regexp_matches(new.content, '@\[[^\]]*\]\(user:([0-9a-f-]{36})\)', 'g'))[1]
  loop
    begin
      v_recipient := v_uuid::uuid;
    exception when others then continue;
    end;
    if v_recipient = new.author_id or v_recipient = any (v_old) then continue; end if;
    if not public.user_can_see_candidate(v_recipient, new.candidate_id) then continue; end if;

    perform public.emit_notification(
      v_recipient,
      v_cand.tenant_id,
      'mention'::public.notification_category,
      new.author_id,
      v_actor_name,
      v_actor_avatar,
      v_actor_name || ' mentioned you on ' || coalesce(nullif(btrim(v_cand.candidate_name), ''), 'a candidate'),
      coalesce(v_job_title, ''),
      v_preview,
      'candidate',
      new.candidate_id,
      new.job_id,
      new.candidate_id,
      v_link,
      jsonb_build_object('comment_id', new.id)
    );
  end loop;
  return new;
end $$;
create or replace trigger notify_mention
  after insert or update of content on public.candidate_comments
  for each row execute function public.tg_notify_mention();

-- The activity log: a comment outside a job, and no log for private comments.
create or replace function public.log_candidate_note_added()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_candidate_name text;
  v_job_title text;
begin
  if new.is_private then return new; end if;
  select candidate_name into v_candidate_name from public.candidates where id = new.candidate_id;
  select title into v_job_title from public.jobs where id = new.job_id;

  perform public.log_activity(
    p_user_id := new.author_id,
    p_organization_id := new.organization_id,
    p_activity_type := 'candidate_note_added',
    p_title := 'Note added to candidate',
    p_description := 'Note added to ' || coalesce(v_candidate_name, 'a candidate') || coalesce(' in ' || v_job_title, ''),
    p_metadata := jsonb_build_object(
      'candidate_id', new.candidate_id,
      'candidate_name', v_candidate_name,
      'job_id', new.job_id,
      'job_title', v_job_title,
      'comment_id', new.id,
      'content_preview', left(regexp_replace(new.content, '@\[([^\]]*)\]\(user:[0-9a-f-]{36}\)', '@\1', 'g'), 100)
    ),
    p_entity_type := 'candidate_comment',
    p_entity_id := new.id
  );
  return new;
end $$;

-- A client's decision is its own kind of notification, not a mention.
do $$
declare
  f regprocedure;
  d text;
  n int;
begin
  foreach f in array array[
    'public.record_dossier_decision(text,text,text[],text,text)'::regprocedure,
    'public.record_pipeline_decision(text,uuid,text,text[],text,text)'::regprocedure
  ] loop
    d := pg_get_functiondef(f);
    n := (select count(*) from regexp_matches(d, '''mention''::notification_category, NULL,', 'g'));
    if n <> 1 then
      raise exception 'expected one client-decision notification in %, found %', f, n;
    end if;
    execute replace(d, '''mention''::notification_category, NULL,', '''candidate_update''::notification_category, NULL,');
  end loop;
end $$;
update public.notifications set category = 'candidate_update'
where category = 'mention' and metadata ? 'decision' and actor_user_id is null;
