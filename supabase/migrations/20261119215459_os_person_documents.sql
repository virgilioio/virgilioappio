-- Files on a person's profile (Allan, Go! 2026-11-19): agreements signed outside
-- Gio Sign (DocuSign, PDFs, paper) uploaded to an internal member's profile, so
-- they can open them at any time and the company keeps them for compliance.
--
-- Who: People & Access admins (is_os_admin) see everyone's, upload, rename and
-- remove; the person sees and downloads their own; nobody else, never external
-- users (GEX02). Removing hides a file and keeps it (removed_at), with Undo;
-- nothing here erases a file or a row. The history names files, never their
-- contents. When an admin adds one, the person's bell rings.
--
-- Paths in the private bucket person-documents: {tenant_id}/{user_id}/{uuid}-{file name}.

create table public.os_person_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  name text not null check (length(name) between 1 and 200),
  kind text not null default 'agreement' check (kind in ('agreement', 'amendment', 'nda', 'other')),
  signed_on date,
  file_name text not null check (length(file_name) between 1 and 255),
  storage_path text not null unique,
  mime_type text check (mime_type is null or length(mime_type) <= 120),
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 26214400),
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid
);
create index os_person_documents_person on public.os_person_documents (tenant_id, user_id, created_at desc);

comment on table public.os_person_documents is
  'Files on a person''s profile (agreements signed outside Gio Sign): People & Access admins and the person themself only. Removed files are kept.';

-- The person must belong to the workspace, the file must sit in their folder,
-- names are trimmed, a signing date is never in the future, and only the
-- name, kind, signing date and removal change afterwards.
create or replace function public.os_person_documents_validate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  new.name := btrim(new.name);
  new.file_name := btrim(new.file_name);
  if new.signed_on is not null and new.signed_on > (now() at time zone 'America/Mexico_City')::date then
    raise exception 'A signing date can''t be in the future.' using errcode = 'GDC02';
  end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.members m where m.tenant_id = new.tenant_id and m.user_id = new.user_id) then
      raise exception 'This person is not a member of the workspace.' using errcode = 'GDC01';
    end if;
    if new.storage_path not like new.tenant_id::text || '/' || new.user_id::text || '/%' then
      raise exception 'The file isn''t in this person''s folder.' using errcode = 'GDC01';
    end if;
    new.uploaded_by := auth.uid();
    new.created_at := now();
    new.removed_at := null;
    new.removed_by := null;
    return new;
  end if;
  if new.tenant_id <> old.tenant_id or new.user_id <> old.user_id or new.storage_path <> old.storage_path
     or new.file_name <> old.file_name or new.mime_type is distinct from old.mime_type
     or new.size_bytes is distinct from old.size_bytes or new.uploaded_by is distinct from old.uploaded_by
     or new.created_at <> old.created_at then
    raise exception 'A file stays with the person it was uploaded for.' using errcode = 'GDC01';
  end if;
  if new.removed_at is not null and old.removed_at is null then
    new.removed_at := now();
    new.removed_by := auth.uid();
  elsif new.removed_at is null and old.removed_at is not null then
    new.removed_by := null;
  else
    new.removed_at := old.removed_at;
    new.removed_by := old.removed_by;
  end if;
  return new;
end;
$function$;

-- External users: People & Access keeps nothing for them (GEX02).
create trigger a0_os_person_documents_external
  before insert or update on public.os_person_documents
  for each row execute function public.os_refuse_external();

create trigger os_person_documents_validate
  before insert or update on public.os_person_documents
  for each row execute function public.os_person_documents_validate();

-- History (names, never contents) and the person's bell.
create or replace function public.os_person_documents_after()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  who text;
  changed text[] := '{}';
begin
  if tg_op = 'INSERT' then
    insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
    values (new.tenant_id, auth.uid(), new.user_id, 'person.document_added', jsonb_build_object('name', new.name, 'kind', new.kind));
    if auth.uid() is not null and auth.uid() <> new.user_id then
      select nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '') into who
      from public.profiles p where p.user_id = auth.uid();
      insert into public.notifications (user_id, tenant_id, category, actor_user_id, actor_name, title, subtitle,
                                        entity_kind, entity_id, action_url, metadata)
      values (new.user_id, new.tenant_id, 'account'::public.notification_category, auth.uid(), who,
              case when new.kind = 'agreement' then 'A new agreement was added to your profile'
                   else 'A new document was added to your profile' end,
              coalesce(who, 'An admin') || ' added ' || new.name || '.',
              'person_document', new.id, '/me?tab=agreements',
              jsonb_build_object('kind', 'person_document'));
    end if;
    return new;
  end if;
  if new.removed_at is not null and old.removed_at is null then
    insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
    values (new.tenant_id, auth.uid(), new.user_id, 'person.document_removed', jsonb_build_object('name', new.name));
  elsif new.removed_at is null and old.removed_at is not null then
    insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
    values (new.tenant_id, auth.uid(), new.user_id, 'person.document_restored', jsonb_build_object('name', new.name));
  end if;
  if new.name <> old.name then changed := array_append(changed, 'name'); end if;
  if new.kind <> old.kind then changed := array_append(changed, 'kind'); end if;
  if new.signed_on is distinct from old.signed_on then changed := array_append(changed, 'signed_on'); end if;
  if cardinality(changed) > 0 then
    insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
    values (new.tenant_id, auth.uid(), new.user_id, 'person.document_updated', jsonb_build_object('name', new.name, 'fields', to_jsonb(changed)));
  end if;
  return new;
end;
$function$;

create trigger os_person_documents_after
  after insert or update on public.os_person_documents
  for each row execute function public.os_person_documents_after();

alter table public.os_person_documents enable row level security;

create policy os_person_documents_read on public.os_person_documents
  for select to authenticated
  using (public.is_os_admin(tenant_id) or (user_id = auth.uid() and removed_at is null));
create policy os_person_documents_insert on public.os_person_documents
  for insert to authenticated
  with check (public.is_os_admin(tenant_id) and removed_at is null);
create policy os_person_documents_update on public.os_person_documents
  for update to authenticated
  using (public.is_os_admin(tenant_id))
  with check (public.is_os_admin(tenant_id));

-- Supabase grants every new table to anon and authenticated; keep only what's needed.
revoke all on public.os_person_documents from anon, authenticated;
grant select on public.os_person_documents to authenticated;
grant insert (tenant_id, user_id, name, kind, signed_on, file_name, storage_path, mime_type, size_bytes)
  on public.os_person_documents to authenticated;
grant update (name, kind, signed_on, removed_at) on public.os_person_documents to authenticated;

-- Storage: the workspace a path belongs to ({tenant_id}/{user_id}/...), and
-- whether the caller may open it (an admin, or the person while it's on their profile).
create or replace function public.os_person_document_tenant(p_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and split_part(p_name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end
$$;

create or replace function public.os_person_document_can_read(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_os_admin(public.os_person_document_tenant(p_name))
      or exists (
        select 1 from public.os_person_documents d
        where d.storage_path = p_name and d.user_id = auth.uid() and d.removed_at is null
      )
$$;

revoke all on function public.os_person_document_tenant(text) from public, anon;
revoke all on function public.os_person_document_can_read(text) from public, anon;
grant execute on function public.os_person_document_tenant(text) to authenticated, service_role;
grant execute on function public.os_person_document_can_read(text) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('person-documents', 'person-documents', false, 26214400, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/png',
  'image/jpeg',
  'image/webp'
])
on conflict (id) do nothing;

create policy person_documents_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'person-documents' and public.is_os_admin(public.os_person_document_tenant(name)));
create policy person_documents_read on storage.objects for select to authenticated
  using (bucket_id = 'person-documents' and public.os_person_document_can_read(name));
