-- Gio Sign: Phase 1 schema (build step 1). DRAFT FOR REVIEW, not applied.
-- Source of truth: "Gio Sign · Consolidated Plan" §2, §2b, §2d, §5 and the
-- Step 0 plan (2026-10-16). The file is renamed to the version it is applied
-- with.
--
-- Shape
--   One shared backend for Sign, here in the Gio ATS project. Gio Sales never
--   reads these tables: it calls the sign-gateway Edge Function (HMAC, like
--   google-gateway) and keeps a read-only mirror of its own deals' agreements.
--   Signers are never users: they reach their envelope only through
--   sign-session / sign-submit with a hashed, single-use token.
--
--   Templates and envelopes share the same child tables (documents,
--   recipients, fields). A child row belongs to exactly one of the two, so the
--   fields editor works on both. Template roles are recipient rows with a
--   label and no person.
--
-- Rules kept
--   Deny-by-default RLS on every table. Clients edit drafts (and scheduled
--   envelopes) only; every status change goes through a security-definer RPC
--   or an Edge Function. Token and code hashes live in a table with no
--   policies. Nothing is ever removed: drafts, documents, recipients, fields
--   and templates are soft-removed so Undo works. sign_events is append-only.

-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------
create type public.sign_kind as enum ('customer', 'candidate', 'member');

-- queued = "Send now" was pressed; emails go out when dispatch_at passes
-- unless the sender pressed Undo (back to draft).
create type public.sign_status as enum
  ('draft', 'scheduled', 'queued', 'sent', 'completed', 'declined', 'voided', 'expired');

create type public.sign_recipient_role as enum ('signer', 'approver', 'cc');

create type public.sign_recipient_status as enum
  ('waiting', 'sent', 'viewed', 'signed', 'approved', 'declined');

create type public.sign_source as enum ('deal', 'company', 'ats_offer', 'member');

-- ---------------------------------------------------------------------------
-- 2. Who can use Sign
-- ---------------------------------------------------------------------------
-- People & Access grants Sign like any other app (Allan, 2026-10-16: keep it
-- simple). sender = any type of envelope (Customer, Candidate, Member), from a
-- template or an uploaded PDF; sees their own envelopes and those they're a
-- recipient on; creates templates and edits their own. admin = also every
-- envelope and every template. Workspace admins and platform admins are always
-- Sign admins. A job role (TA, Sales) can carry the grant. Gio Sales reps don't
-- need an ATS grant to send from a deal: Gio Sales vouches for them through
-- sign-gateway, for Customer envelopes on its deals.
insert into public.os_apps (key, name, roles, sort_order)
values ('sign', 'Gio Sign', array['sender', 'admin'], 4);

create or replace function public.sign_access(_tenant_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when public.is_os_admin(_tenant_id) then 'admin'
    else (
      select g.role
      from public.os_app_grants g
      where g.tenant_id = _tenant_id
        and g.user_id = auth.uid()
        and g.app_key = 'sign'
        and g.status = 'active'
        and public.is_active_member(_tenant_id)
      limit 1
    )
  end;
$function$;

create or replace function public.sign_my_email()
returns text
language sql
stable
set search_path to 'public'
as $function$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$function$;

-- Short, human envelope id shown on signatures and the certificate (4F9A-21C7-8B3E).
create or replace function public.sign_new_public_id()
returns text
language sql
volatile
set search_path to 'public'
as $function$
  select upper(substr(h, 1, 4) || '-' || substr(h, 5, 4) || '-' || substr(h, 9, 4))
  from (select md5(gen_random_uuid()::text) as h) s;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Templates
-- ---------------------------------------------------------------------------
create table public.sign_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text check (description is null or length(description) <= 500),
  kind public.sign_kind not null,
  -- Where people can pick it (Allan, 2026-10-16): 'sales' = only in Gio Sales
  -- (Send agreement on a deal), 'ats' = only in the ATS Sign module. Every
  -- template is managed in the ATS. The wizard defaults Customer to 'sales'.
  app text not null default 'ats' check (app in ('ats', 'sales')),
  ordered boolean not null default true,
  subject text not null default '' check (length(subject) <= 200),
  body text not null default '' check (length(body) <= 5000),
  reminder_days smallint not null default 2 check (reminder_days between 0 and 3),
  expiry_days smallint not null default 30 check (expiry_days in (7, 14, 30, 60)),
  uses integer not null default 0 check (uses >= 0),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index sign_templates_tenant on public.sign_templates (tenant_id, app, kind) where archived_at is null;

-- ---------------------------------------------------------------------------
-- 4. Envelopes
-- ---------------------------------------------------------------------------
create table public.sign_envelopes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  public_id text not null unique default public.sign_new_public_id(),
  title text not null check (length(btrim(title)) between 1 and 160),
  kind public.sign_kind not null,
  status public.sign_status not null default 'draft',

  -- The record the data comes from and the signed copy goes back to.
  -- deal / company ids are Gio Sales ids (another project, so no FK);
  -- ats_offer = offer_letters.id; member = auth.users.id.
  source_type public.sign_source,
  source_id uuid,
  source_label text check (source_label is null or length(source_label) <= 200),
  source_sub text check (source_sub is null or length(source_sub) <= 200),
  sales_org_id uuid,
  sales_company_id uuid,
  template_id uuid references public.sign_templates(id),

  ordered boolean not null default true,
  subject text not null default '' check (length(subject) <= 200),
  body text not null default '' check (length(body) <= 5000),
  reminder_days smallint not null default 2 check (reminder_days between 0 and 3),
  expiry_days smallint not null default 30 check (expiry_days in (7, 14, 30, 60)),

  -- Values the sender typed for data tags the record doesn't hold (e.g. a
  -- guarantee period). data_snapshot = every value, frozen at send.
  data_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(data_overrides) = 'object'),
  data_snapshot jsonb check (data_snapshot is null or jsonb_typeof(data_snapshot) = 'object'),

  -- Who sends it. ATS senders have sender_user_id; envelopes sent from Gio
  -- Sales carry the Sales user id instead.
  origin text not null default 'ats' check (origin in ('ats', 'sales')),
  sender_user_id uuid references auth.users(id),
  sender_sales_user_id uuid,
  sender_name text not null check (length(btrim(sender_name)) between 1 and 120),
  sender_email text not null check (sender_email = lower(sender_email)),

  scheduled_at timestamptz,
  dispatch_at timestamptz,
  sent_at timestamptz,
  expires_at timestamptz,
  completed_at timestamptz,
  declined_at timestamptz,
  voided_at timestamptz,
  void_reason text check (void_reason is null or length(btrim(void_reason)) between 3 and 500),
  last_reminded_at timestamptz,

  -- Sealing output (private bucket sign-files).
  sealed_path text,
  sealed_sha256 text,
  certificate_path text,
  seal_error text check (seal_error is null or length(seal_error) <= 500),
  nom151_path text,

  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Drafts only; Undo clears it.
  deleted_at timestamptz,
  deleted_by uuid,

  check ((source_type is null) = (source_id is null)),
  check (source_type is null or ((kind = 'customer') = (source_type in ('deal', 'company')))),
  check (source_type is null or ((kind = 'candidate') = (source_type = 'ats_offer'))),
  check (source_type is null or ((kind = 'member') = (source_type = 'member'))),
  check ((origin = 'ats') = (sender_user_id is not null)),
  check (origin = 'ats' or (kind = 'customer' and sender_sales_user_id is not null and sales_org_id is not null)),
  check (status <> 'scheduled' or scheduled_at is not null),
  check (status <> 'queued' or dispatch_at is not null),
  check (status <> 'voided' or (void_reason is not null and voided_at is not null)),
  check (deleted_at is null or status = 'draft')
);

create index sign_envelopes_list on public.sign_envelopes (tenant_id, status, updated_at desc) where deleted_at is null;
create index sign_envelopes_source on public.sign_envelopes (source_type, source_id);
create index sign_envelopes_sales_company on public.sign_envelopes (sales_company_id) where sales_company_id is not null;
create index sign_envelopes_due on public.sign_envelopes (scheduled_at) where status = 'scheduled';
create index sign_envelopes_queue on public.sign_envelopes (dispatch_at) where status = 'queued';
create index sign_envelopes_open on public.sign_envelopes (expires_at) where status = 'sent';

-- ---------------------------------------------------------------------------
-- 5. Documents, recipients (roles), fields
-- ---------------------------------------------------------------------------
create table public.sign_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  envelope_id uuid references public.sign_envelopes(id),
  template_id uuid references public.sign_templates(id),
  position smallint not null default 0 check (position between 0 and 49),
  name text not null check (length(btrim(name)) between 1 and 200),
  storage_path text not null unique,
  page_count smallint not null check (page_count between 1 and 200),
  -- [{ "w": points, "h": points }] per page, so % positions map onto the PDF.
  page_sizes jsonb not null default '[]'::jsonb check (jsonb_typeof(page_sizes) = 'array'),
  size_bytes integer not null check (size_bytes between 1 and 26214400),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  check (num_nonnulls(envelope_id, template_id) = 1)
);

create index sign_documents_envelope on public.sign_documents (envelope_id, position) where envelope_id is not null;
create index sign_documents_template on public.sign_documents (template_id, position) where template_id is not null;

create table public.sign_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  envelope_id uuid references public.sign_envelopes(id),
  template_id uuid references public.sign_templates(id),
  position smallint not null check (position between 1 and 20),
  role public.sign_recipient_role not null default 'signer',
  label text check (label is null or length(btrim(label)) between 1 and 60),
  name text check (name is null or length(name) <= 120),
  email text check (email is null or (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- A template role fixed to one person (the countersigner).
  fixed boolean not null default false,
  status public.sign_recipient_status not null default 'waiting',
  -- Set when the email belongs to an ATS member, for "Waiting on me".
  user_id uuid references auth.users(id),
  consent_at timestamptz,
  verified_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  approved_at timestamptz,
  declined_at timestamptz,
  decline_reason text check (decline_reason is null or length(btrim(decline_reason)) between 3 and 500),
  signed_ip inet,
  signed_user_agent text check (signed_user_agent is null or length(signed_user_agent) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  check (num_nonnulls(envelope_id, template_id) = 1),
  check (template_id is null or label is not null),
  check (status <> 'declined' or decline_reason is not null)
);

create index sign_recipients_envelope on public.sign_recipients (envelope_id, position) where envelope_id is not null;
create index sign_recipients_template on public.sign_recipients (template_id, position) where template_id is not null;
create index sign_recipients_email on public.sign_recipients (email) where envelope_id is not null and removed_at is null;

-- Link and code secrets. No policies: only Edge Functions (service role) read them.
create table public.sign_recipient_secrets (
  recipient_id uuid primary key references public.sign_recipients(id),
  token_hash text unique,
  token_issued_at timestamptz,
  token_expires_at timestamptz,
  code_hash text,
  code_sent_at timestamptz,
  code_expires_at timestamptz,
  code_attempts smallint not null default 0 check (code_attempts between 0 and 5),
  session_hash text unique,
  session_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.sign_fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  envelope_id uuid references public.sign_envelopes(id),
  template_id uuid references public.sign_templates(id),
  recipient_id uuid references public.sign_recipients(id),
  type text not null check (type in ('signature', 'initials', 'date', 'name', 'email', 'text', 'checkbox', 'data')),
  -- Global page index across the envelope's documents, in order.
  page smallint not null check (page between 0 and 999),
  x numeric(6, 3) not null check (x between 0 and 100),
  y numeric(6, 3) not null check (y between 0 and 100),
  w numeric(6, 3) not null check (w > 0 and w <= 100),
  h numeric(6, 3) not null check (h > 0 and h <= 100),
  required boolean not null default true,
  data_key text check (data_key is null or data_key ~ '^[a-z][a-z_]{0,39}$'),
  label text check (label is null or length(label) <= 200),
  value text check (value is null or length(value) <= 2000),
  filled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  check (num_nonnulls(envelope_id, template_id) = 1),
  check ((type = 'data') = (data_key is not null)),
  check ((type = 'data') = (recipient_id is null)),
  check (x + w <= 100.001 and y + h <= 100.001)
);

create index sign_fields_envelope on public.sign_fields (envelope_id) where envelope_id is not null and removed_at is null;
create index sign_fields_template on public.sign_fields (template_id) where template_id is not null and removed_at is null;
create index sign_fields_recipient on public.sign_fields (recipient_id) where recipient_id is not null;

-- ---------------------------------------------------------------------------
-- 6. Adopted signatures, audit trail, notification preferences
-- ---------------------------------------------------------------------------
create table public.sign_signatures (
  recipient_id uuid primary key references public.sign_recipients(id),
  tenant_id uuid not null references public.tenants(id),
  kind text not null check (kind in ('type', 'draw', 'upload')),
  full_name text not null check (length(btrim(full_name)) between 1 and 120),
  initials text not null check (length(btrim(initials)) between 1 and 4),
  font text check (font is null or font in ('Caveat', 'Dancing Script', 'Homemade Apple', 'Mr Dafoe')),
  image_path text,
  initials_image_path text,
  adopted_at timestamptz not null default now(),
  check ((kind = 'type') = (font is not null)),
  check (kind = 'type' or image_path is not null)
);

-- Append-only. Clients can read the trail of envelopes they can see; only
-- security-definer functions and Edge Functions write it.
create table public.sign_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id),
  envelope_id uuid not null references public.sign_envelopes(id),
  recipient_id uuid references public.sign_recipients(id),
  kind text not null check (kind in (
    'created', 'scheduled', 'unscheduled', 'queued', 'send_undone', 'sent',
    'opened', 'consented', 'code_sent', 'code_verified', 'code_failed',
    'signed', 'approved', 'declined', 'corrected', 'voided', 'reminded',
    'expiring', 'expired', 'sealed', 'seal_failed', 'delivered', 'preserved')),
  label text not null check (length(label) <= 300),
  key boolean not null default false,
  actor_name text,
  actor_email text,
  actor_user_id uuid,
  ip inet,
  user_agent text check (user_agent is null or length(user_agent) <= 500),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index sign_events_envelope on public.sign_events (envelope_id, created_at desc);

-- Per sender, per event: email and/or in-app. Keyed by email so Gio Sales
-- senders (who have no ATS account) share the same store. A missing row
-- means the default from sign_pref().
create table public.sign_notification_prefs (
  tenant_id uuid not null references public.tenants(id),
  email text not null check (email = lower(email)),
  event text not null check (event in ('signed', 'completed', 'declined', 'viewed', 'expiring')),
  by_email boolean not null,
  in_app boolean not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, email, event)
);

create or replace function public.sign_pref(_tenant_id uuid, _email text, _event text)
returns table (by_email boolean, in_app boolean)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(p.by_email, d.by_email), coalesce(p.in_app, d.in_app)
  from (values
    ('signed', true, true), ('completed', true, true), ('declined', true, true),
    ('viewed', false, true), ('expiring', true, false)
  ) as d(event, by_email, in_app)
  left join public.sign_notification_prefs p
    on p.tenant_id = _tenant_id and p.email = lower(_email) and p.event = d.event
  where d.event = _event;
$function$;

-- In-app bell rows for Sign events (rows are written by Edge Functions).
alter type public.notification_category add value if not exists 'sign';

-- ---------------------------------------------------------------------------
-- 7. Visibility helpers (security definer, so policies don't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.sign_can_view_envelope(_envelope_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.sign_envelopes e
    where e.id = _envelope_id
      and public.sign_access(e.tenant_id) is not null
      and (
        public.sign_access(e.tenant_id) = 'admin'
        or e.created_by = auth.uid()
        or e.sender_user_id = auth.uid()
        or exists (
          select 1 from public.sign_recipients r
          where r.envelope_id = e.id and r.removed_at is null
            and (r.user_id = auth.uid() or r.email = public.sign_my_email())
        )
      )
  );
$function$;

-- Drafts and scheduled envelopes are editable by their sender or a Sign admin.
create or replace function public.sign_can_edit_envelope(_envelope_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.sign_envelopes e
    where e.id = _envelope_id
      and e.status in ('draft', 'scheduled')
      and e.deleted_at is null
      and e.origin = 'ats'
      and public.sign_access(e.tenant_id) is not null
      and (public.sign_access(e.tenant_id) = 'admin' or e.created_by = auth.uid())
  );
$function$;

create or replace function public.sign_can_view_template(_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.sign_templates t
    where t.id = _template_id and public.sign_access(t.tenant_id) is not null
  );
$function$;

create or replace function public.sign_can_edit_template(_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.sign_templates t
    where t.id = _template_id and t.archived_at is null
      and (public.sign_access(t.tenant_id) = 'admin'
           or (public.sign_access(t.tenant_id) is not null and t.created_by = auth.uid()))
  );
$function$;

-- ---------------------------------------------------------------------------
-- 8. Invariants in triggers
-- ---------------------------------------------------------------------------
-- Envelopes: clients can't change status, sending data or identity. Status
-- moves only through the RPCs below or Edge Functions (service role).
create or replace function public.sign_envelopes_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  if coalesce(auth.role(), '') = 'service_role'
     or coalesce(current_setting('gio.sign_rpc', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.origin <> 'ats' then
      raise exception 'New envelopes start as drafts.' using errcode = 'GSN01';
    end if;
    if public.sign_access(new.tenant_id) is null then
      raise exception 'You don''t have access to Sign.' using errcode = 'GSN02';
    end if;
    new.created_by := auth.uid();
    new.sender_user_id := auth.uid();
    new.sender_email := public.sign_my_email();
    new.data_snapshot := null;
    new.deleted_at := null;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.tenant_id is distinct from old.tenant_id
     or new.public_id is distinct from old.public_id
     or new.origin is distinct from old.origin
     or new.sender_user_id is distinct from old.sender_user_id
     or new.sender_email is distinct from old.sender_email
     or new.created_by is distinct from old.created_by
     or new.data_snapshot is distinct from old.data_snapshot
     or new.scheduled_at is distinct from old.scheduled_at
     or new.dispatch_at is distinct from old.dispatch_at
     or new.sent_at is distinct from old.sent_at
     or new.sealed_path is distinct from old.sealed_path
     or new.void_reason is distinct from old.void_reason then
    raise exception 'That change goes through Send, Schedule or Void.' using errcode = 'GSN03';
  end if;
  if old.status not in ('draft', 'scheduled') then
    raise exception 'Only drafts and scheduled envelopes can be edited. Use Correct for one that''s out for signature.' using errcode = 'GSN04';
  end if;
  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'Use Remove draft or Undo.' using errcode = 'GSN03';
  end if;
  return new;
end;
$function$;

create trigger sign_envelopes_a_guard
  before insert or update on public.sign_envelopes
  for each row execute function public.sign_envelopes_guard();

-- Children: the tenant always matches the parent, and client writes only touch
-- editable parents (enforced again here, besides RLS, because recipients carry
-- signing state the client must never set).
create or replace function public.sign_children_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  parent_tenant uuid;
begin
  if new.envelope_id is not null then
    select tenant_id into parent_tenant from public.sign_envelopes where id = new.envelope_id;
  else
    select tenant_id into parent_tenant from public.sign_templates where id = new.template_id;
  end if;
  if parent_tenant is null or parent_tenant <> new.tenant_id then
    raise exception 'That envelope or template is not in this workspace.' using errcode = 'GSN05';
  end if;
  if tg_op = 'UPDATE' and (new.envelope_id is distinct from old.envelope_id or new.template_id is distinct from old.template_id) then
    raise exception 'A row can''t move to another envelope or template.' using errcode = 'GSN05';
  end if;

  if coalesce(auth.role(), '') = 'service_role'
     or coalesce(current_setting('gio.sign_rpc', true), '') = 'on' then
    return new;
  end if;

  if tg_table_name = 'sign_recipients' then
    if tg_op = 'INSERT' then
      new.status := 'waiting';
      new.consent_at := null; new.verified_at := null; new.viewed_at := null;
      new.signed_at := null; new.approved_at := null; new.declined_at := null;
      new.decline_reason := null; new.signed_ip := null; new.signed_user_agent := null;
    elsif new.status is distinct from old.status
       or new.signed_at is distinct from old.signed_at
       or new.consent_at is distinct from old.consent_at
       or new.verified_at is distinct from old.verified_at
       or new.declined_at is distinct from old.declined_at
       or new.signed_ip is distinct from old.signed_ip then
      raise exception 'Signing state is recorded by Gio Sign, not edited.' using errcode = 'GSN06';
    end if;
  end if;
  -- Field values are filled by signers (through sign-submit) or frozen at send.
  if tg_table_name = 'sign_fields' then
    if tg_op = 'INSERT' then
      new.value := null;
      new.filled_at := null;
    else
      new.value := old.value;
      new.filled_at := old.filled_at;
    end if;
  end if;
  return new;
end;
$function$;

create trigger sign_documents_a_guard before insert or update on public.sign_documents
  for each row execute function public.sign_children_guard();
create trigger sign_recipients_a_guard before insert or update on public.sign_recipients
  for each row execute function public.sign_children_guard();
create trigger sign_fields_a_guard before insert or update on public.sign_fields
  for each row execute function public.sign_children_guard();

create or replace function public.sign_touch()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger sign_templates_touch before update on public.sign_templates
  for each row execute function public.sign_touch();
create trigger sign_recipients_touch before update on public.sign_recipients
  for each row execute function public.sign_touch();
create trigger sign_fields_touch before update on public.sign_fields
  for each row execute function public.sign_touch();

-- ---------------------------------------------------------------------------
-- 9. Status RPCs the client may call (everything that sends email is an
--    Edge Function: sign-send, sign-void, sign-correct, sign-remind)
-- ---------------------------------------------------------------------------
create or replace function public.sign_log(
  _envelope_id uuid, _kind text, _label text, _key boolean default false, _detail jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into public.sign_events (tenant_id, envelope_id, kind, label, key, actor_name, actor_email, actor_user_id, detail)
  select e.tenant_id, e.id, _kind, _label, _key,
         coalesce((select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '') from public.profiles p where p.user_id = auth.uid()), public.sign_my_email()),
         public.sign_my_email(), auth.uid(), coalesce(_detail, '{}'::jsonb)
  from public.sign_envelopes e where e.id = _envelope_id;
$function$;

-- Schedule a draft (the date must be in the future).
create or replace function public.sign_schedule(_envelope_id uuid, _at timestamptz)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.sign_can_edit_envelope(_envelope_id) then
    raise exception 'You can''t schedule this envelope.' using errcode = 'GSN07';
  end if;
  if _at <= now() + interval '1 minute' then
    raise exception 'Pick a date and time in the future.' using errcode = 'GSN08';
  end if;
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes set status = 'scheduled', scheduled_at = _at where id = _envelope_id;
  perform public.sign_log(_envelope_id, 'scheduled', 'Scheduled for ' || to_char(_at at time zone 'America/Mexico_City', 'Mon DD, HH24:MI'), true);
end;
$function$;

-- Cancel schedule: back to Draft, no one emailed. Undo calls sign_schedule again.
create or replace function public.sign_unschedule(_envelope_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.sign_envelopes where id = _envelope_id and status = 'scheduled')
     or not public.sign_can_edit_envelope(_envelope_id) then
    raise exception 'Only a scheduled envelope can go back to Drafts.' using errcode = 'GSN07';
  end if;
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes set status = 'draft', scheduled_at = null where id = _envelope_id;
  perform public.sign_log(_envelope_id, 'unscheduled', 'Schedule cancelled');
end;
$function$;

-- Undo within the 5-second window after Send. Fails once emails went out.
create or replace function public.sign_undo_send(_envelope_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes
     set status = 'draft', dispatch_at = null, data_snapshot = null
   where id = _envelope_id
     and status = 'queued'
     and dispatch_at > now()
     and (created_by = auth.uid() or public.sign_access(tenant_id) = 'admin');
  if not found then
    return false;
  end if;
  perform public.sign_log(_envelope_id, 'send_undone', 'Sending undone. No one was emailed.');
  return true;
end;
$function$;

-- Remove a draft (soft) and its Undo.
create or replace function public.sign_set_draft_removed(_envelope_id uuid, _removed boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.sign_envelopes e
    where e.id = _envelope_id and e.status = 'draft' and e.origin = 'ats'
      and public.sign_access(e.tenant_id) is not null
      and (public.sign_access(e.tenant_id) = 'admin' or e.created_by = auth.uid())
  ) then
    raise exception 'Only your own drafts can be removed.' using errcode = 'GSN07';
  end if;
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes
     set deleted_at = case when _removed then now() else null end,
         deleted_by = case when _removed then auth.uid() else null end
   where id = _envelope_id;
end;
$function$;

revoke execute on function
  public.sign_access(uuid), public.sign_can_view_envelope(uuid), public.sign_can_edit_envelope(uuid),
  public.sign_can_view_template(uuid), public.sign_can_edit_template(uuid), public.sign_pref(uuid, text, text),
  public.sign_log(uuid, text, text, boolean, jsonb), public.sign_schedule(uuid, timestamptz),
  public.sign_unschedule(uuid), public.sign_undo_send(uuid), public.sign_set_draft_removed(uuid, boolean)
  from public, anon;
grant execute on function
  public.sign_access(uuid), public.sign_can_view_envelope(uuid), public.sign_can_edit_envelope(uuid),
  public.sign_can_view_template(uuid), public.sign_can_edit_template(uuid),
  public.sign_schedule(uuid, timestamptz), public.sign_unschedule(uuid), public.sign_undo_send(uuid),
  public.sign_set_draft_removed(uuid, boolean)
  to authenticated;
grant execute on function public.sign_pref(uuid, text, text), public.sign_log(uuid, text, text, boolean, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- 10. Row Level Security (deny by default; no remove policies anywhere)
-- ---------------------------------------------------------------------------
alter table public.sign_templates enable row level security;
alter table public.sign_envelopes enable row level security;
alter table public.sign_documents enable row level security;
alter table public.sign_recipients enable row level security;
alter table public.sign_recipient_secrets enable row level security;
alter table public.sign_fields enable row level security;
alter table public.sign_signatures enable row level security;
alter table public.sign_events enable row level security;
alter table public.sign_notification_prefs enable row level security;

-- Templates: every Sign user reads and creates; the creator or a Sign admin edits and archives.
create policy sign_templates_read on public.sign_templates for select to authenticated
  using (public.sign_access(tenant_id) is not null);
create policy sign_templates_insert on public.sign_templates for insert to authenticated
  with check (public.sign_access(tenant_id) is not null and created_by = auth.uid());
create policy sign_templates_update on public.sign_templates for update to authenticated
  using (public.sign_access(tenant_id) = 'admin' or (public.sign_access(tenant_id) is not null and created_by = auth.uid()))
  with check (public.sign_access(tenant_id) is not null);

-- Envelopes.
create policy sign_envelopes_read on public.sign_envelopes for select to authenticated
  using (public.sign_can_view_envelope(id));
create policy sign_envelopes_insert on public.sign_envelopes for insert to authenticated
  with check (public.sign_access(tenant_id) is not null);
create policy sign_envelopes_update on public.sign_envelopes for update to authenticated
  using (public.sign_can_edit_envelope(id)) with check (public.sign_access(tenant_id) is not null);

-- Documents, recipients, fields: follow the parent.
create policy sign_documents_read on public.sign_documents for select to authenticated
  using ((envelope_id is not null and public.sign_can_view_envelope(envelope_id))
      or (template_id is not null and public.sign_can_view_template(template_id)));
create policy sign_documents_write on public.sign_documents for insert to authenticated
  with check ((envelope_id is not null and public.sign_can_edit_envelope(envelope_id))
           or (template_id is not null and public.sign_can_edit_template(template_id)));
create policy sign_documents_update on public.sign_documents for update to authenticated
  using ((envelope_id is not null and public.sign_can_edit_envelope(envelope_id))
      or (template_id is not null and public.sign_can_edit_template(template_id)));

create policy sign_recipients_read on public.sign_recipients for select to authenticated
  using ((envelope_id is not null and public.sign_can_view_envelope(envelope_id))
      or (template_id is not null and public.sign_can_view_template(template_id)));
create policy sign_recipients_write on public.sign_recipients for insert to authenticated
  with check ((envelope_id is not null and public.sign_can_edit_envelope(envelope_id))
           or (template_id is not null and public.sign_can_edit_template(template_id)));
create policy sign_recipients_update on public.sign_recipients for update to authenticated
  using ((envelope_id is not null and public.sign_can_edit_envelope(envelope_id))
      or (template_id is not null and public.sign_can_edit_template(template_id)));

create policy sign_fields_read on public.sign_fields for select to authenticated
  using ((envelope_id is not null and public.sign_can_view_envelope(envelope_id))
      or (template_id is not null and public.sign_can_view_template(template_id)));
create policy sign_fields_write on public.sign_fields for insert to authenticated
  with check ((envelope_id is not null and public.sign_can_edit_envelope(envelope_id))
           or (template_id is not null and public.sign_can_edit_template(template_id)));
create policy sign_fields_update on public.sign_fields for update to authenticated
  using ((envelope_id is not null and public.sign_can_edit_envelope(envelope_id))
      or (template_id is not null and public.sign_can_edit_template(template_id)));

-- Audit trail: read with the envelope; written only by definer functions / Edge Functions.
create policy sign_events_read on public.sign_events for select to authenticated
  using (public.sign_can_view_envelope(envelope_id));

-- Preferences: your own rows (by email).
create policy sign_prefs_read on public.sign_notification_prefs for select to authenticated
  using (email = public.sign_my_email() and public.user_has_tenant_access(tenant_id));
create policy sign_prefs_insert on public.sign_notification_prefs for insert to authenticated
  with check (email = public.sign_my_email() and public.user_has_tenant_access(tenant_id));
create policy sign_prefs_update on public.sign_notification_prefs for update to authenticated
  using (email = public.sign_my_email()) with check (email = public.sign_my_email());

-- sign_recipient_secrets and sign_signatures: no client policies at all.

revoke all on public.sign_recipient_secrets, public.sign_signatures from anon, authenticated;
revoke insert, update on public.sign_events from anon, authenticated;
grant all on
  public.sign_templates, public.sign_envelopes, public.sign_documents, public.sign_recipients,
  public.sign_recipient_secrets, public.sign_fields, public.sign_signatures, public.sign_events,
  public.sign_notification_prefs
  to service_role;

-- Live row updates on the Envelopes page (realtime respects RLS).
alter publication supabase_realtime add table public.sign_envelopes, public.sign_recipients;

-- ---------------------------------------------------------------------------
-- 11. Storage: private bucket sign-files
-- ---------------------------------------------------------------------------
-- Paths
--   {tenant}/drafts/{user}/{uuid}.pdf      uploads while composing (the sender)
--   {tenant}/templates/{template}/{uuid}.pdf template documents (any Sign user)
--   {tenant}/envelopes/{envelope}/...       frozen copies, signatures, sealed PDF,
--                                           certificate: written by Edge Functions only
-- Reads of envelope files always go through short-lived signed URLs made by
-- Edge Functions.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sign-files', 'sign-files', false, 26214400, array['application/pdf', 'image/png', 'image/jpeg']);

create policy sign_files_draft_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sign-files'
    and (storage.foldername(name))[2] = 'drafts'
    and (storage.foldername(name))[3] = auth.uid()::text
    and public.sign_access(((storage.foldername(name))[1])::uuid) is not null
  );
create policy sign_files_draft_read on storage.objects for select to authenticated
  using (
    bucket_id = 'sign-files'
    and (storage.foldername(name))[2] = 'drafts'
    and (storage.foldername(name))[3] = auth.uid()::text
  );
create policy sign_files_template_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sign-files'
    and (storage.foldername(name))[2] = 'templates'
    and public.sign_access(((storage.foldername(name))[1])::uuid) is not null
  );
create policy sign_files_template_read on storage.objects for select to authenticated
  using (
    bucket_id = 'sign-files'
    and (storage.foldername(name))[2] = 'templates'
    and public.sign_access(((storage.foldername(name))[1])::uuid) is not null
  );

-- ---------------------------------------------------------------------------
-- 12. Schedules (enabled in build step 8, once the functions exist)
-- ---------------------------------------------------------------------------
-- select cron.schedule('sign-schedule', '* * * * *',  <net.http_post to sign-schedule>);
-- select cron.schedule('sign-remind',   '7 * * * *',  <net.http_post to sign-remind>);
