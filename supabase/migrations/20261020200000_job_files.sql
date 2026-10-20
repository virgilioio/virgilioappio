-- Job files (Allan, 2026-10-20): intake notes, client briefs and old JDs uploaded in
-- a job's Job description step. They are kept with the job and their text feeds
-- "Draft with Gio" (job description) and "Generate with Gio" (skills).
--
-- Who: whoever can edit the job (can_edit_job: platform admins, and members with
-- recruiter access or more to the job's client). Files are taken off a job with
-- removed_at (kept for the record), never erased from here.
-- Paths in the private bucket job-files: {job_id}/{uuid}-{file name}.
-- No foreign key to jobs: jobs are still erased outright (CLAUDE.md), and a key
-- would block that. A row whose job is gone is invisible (can_edit_job is false).

create table public.job_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  file_name text not null check (length(file_name) between 1 and 255),
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint check (size_bytes between 0 and 26214400),
  -- Read in the browser on upload (PDF, Word, text); capped so a prompt stays small.
  extracted_text text check (extracted_text is null or length(extracted_text) <= 200000),
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid
);
create index job_files_job on public.job_files (job_id) where removed_at is null;

alter table public.job_files enable row level security;

create policy job_files_select on public.job_files
  for select to authenticated using (public.can_edit_job(job_id));
create policy job_files_insert on public.job_files
  for insert to authenticated
  with check (
    public.can_edit_job(job_id)
    and uploaded_by = auth.uid()
    and storage_path like job_id::text || '/%'
    and removed_at is null
  );
-- Only taking a file off the job is an update.
create policy job_files_update on public.job_files
  for update to authenticated
  using (public.can_edit_job(job_id))
  with check (public.can_edit_job(job_id));

-- Supabase grants every new table to anon and authenticated; keep only what's needed.
revoke all on public.job_files from anon, authenticated;
grant select, insert on public.job_files to authenticated;
grant update (removed_at) on public.job_files to authenticated;

-- removed_by follows removed_at; a removed file stays removed.
create or replace function public.job_files_a_removed()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.removed_at is not null then
    new.removed_at := old.removed_at;
    new.removed_by := old.removed_by;
  elsif new.removed_at is not null then
    new.removed_at := now();
    new.removed_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger job_files_a_removed before update on public.job_files
  for each row execute function public.job_files_a_removed();

-- The job a storage path belongs to ({job_id}/...), or null for any other shape.
create or replace function public.job_file_job(p_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end
$$;
revoke all on function public.job_file_job(text) from public, anon;
grant execute on function public.job_file_job(text) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-files', 'job-files', false, 26214400, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'application/rtf',
  'text/rtf'
])
on conflict (id) do nothing;

create policy job_files_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'job-files' and public.can_edit_job(public.job_file_job(name)));
create policy job_files_read on storage.objects for select to authenticated
  using (bucket_id = 'job-files' and public.can_edit_job(public.job_file_job(name)));
