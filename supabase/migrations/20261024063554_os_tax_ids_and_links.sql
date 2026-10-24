-- Member profile, part 2 groundwork (Allan, 2026-10-24): tax IDs per country,
-- and useful links for the My profile home.
--
-- 1. os_tax_id_types: the catalogue of tax IDs, by country, seeded with the
--    countries Virgilio's people are in today (Mexico, Colombia, the US,
--    Argentina, Brazil, Chile, Peru, Spain, Canada, the Netherlands, India and
--    the Philippines) plus "Other" for anywhere else. Each type says whether it
--    is a person's or a company's, gives an example, a format, and its
--    check-digit rule where we could confirm one against real numbers. The
--    CURP and a company RFC are checked by format only. India keeps PAN, never
--    Aadhaar (the law limits who may store it).
-- 2. os_person_tax_ids: a person's tax IDs, kept like bank details. The value
--    is encrypted with the same Vault key (os_bank_key), the last four are kept
--    for the masked view, and nobody reads the table: os_tax_ids (masked),
--    os_reveal_tax_id (People & Access admins and Billing, written to the
--    history) and os_save_tax_id / os_remove_tax_id (the person or an admin).
--    When someone else changes or removes one, the person's bell rings.
-- 3. os_useful_links: links People & Access admins pin for everyone in the
--    workspace (title, a line of description, the address, an order). Every
--    member reads them, admins add, edit, reorder and archive them. Nothing is
--    erased, archiving hides a link.

-- 1. The catalogue.
create table public.os_tax_id_types (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  label text not null check (length(label) between 2 and 60),
  holder text not null check (holder in ('person', 'company', 'either')),
  example text not null,
  pattern text not null,
  check_rule text not null default 'none'
    check (check_rule in ('none', 'rfc', 'nit_co', 'cuit', 'cpf', 'cnpj', 'rut', 'ruc', 'nif', 'luhn', 'bsn', 'gstin')),
  note text,
  position int not null default 0
);

comment on table public.os_tax_id_types is
  'Tax IDs by country: format (pattern, on the value without spaces, dots, dashes or slashes) and check-digit rule. Read by everyone signed in.';

insert into public.os_tax_id_types (key, country_code, label, holder, example, pattern, check_rule, note, position) values
  ('mx_rfc', 'MX', 'RFC', 'person', 'GODE561231GR8', '^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{2}[0-9A]$', 'rfc', 'Registro Federal de Contribuyentes, 13 characters', 10),
  ('mx_curp', 'MX', 'CURP', 'person', 'MAHJ280603MSPRRV09', '^[A-Z][AEIOUX][A-Z]{2}[0-9]{6}[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-ZÑ]{3}[A-Z0-9][0-9]$', 'none', 'Clave Única de Registro de Población, 18 characters', 20),
  ('mx_rfc_company', 'MX', 'RFC (company)', 'company', 'ABC680524P76', '^[A-ZÑ&]{3}[0-9]{6}[A-Z0-9]{2}[0-9A]$', 'none', 'A company''s RFC, 12 characters', 30),
  ('co_cc', 'CO', 'Cédula de ciudadanía', 'person', '1020304050', '^[0-9]{6,10}$', 'none', null, 10),
  ('co_nit', 'CO', 'NIT', 'either', '800197268-4', '^[0-9]{6,15}$', 'nit_co', 'With its verification digit last', 20),
  ('us_ssn', 'US', 'SSN', 'person', '123-45-6789', '^(?!000|666|9)[0-9]{3}(?!00)[0-9]{2}(?!0000)[0-9]{4}$', 'none', 'Social Security Number', 10),
  ('us_itin', 'US', 'ITIN', 'person', '912-70-1234', '^9[0-9]{2}(5[0-9]|6[0-5]|7[0-9]|8[0-8]|9[0-2]|9[4-9])[0-9]{4}$', 'none', 'Individual Taxpayer Identification Number', 20),
  ('us_ein', 'US', 'EIN', 'company', '12-3456789', '^(?!00)[0-9]{9}$', 'none', 'Employer Identification Number', 30),
  ('ar_cuil', 'AR', 'CUIL', 'person', '20-12345678-6', '^(20|23|24|27)[0-9]{9}$', 'cuit', null, 10),
  ('ar_cuit', 'AR', 'CUIT', 'either', '30-50001091-2', '^(20|23|24|27|30|33|34)[0-9]{9}$', 'cuit', null, 20),
  ('br_cpf', 'BR', 'CPF', 'person', '529.982.247-25', '^[0-9]{11}$', 'cpf', null, 10),
  ('br_cnpj', 'BR', 'CNPJ', 'company', '11.222.333/0001-81', '^[0-9]{14}$', 'cnpj', null, 20),
  ('cl_rut', 'CL', 'RUT', 'either', '12.345.678-5', '^[0-9]{7,8}[0-9K]$', 'rut', null, 10),
  ('pe_dni', 'PE', 'DNI', 'person', '12345678', '^[0-9]{8}$', 'none', null, 10),
  ('pe_ruc', 'PE', 'RUC', 'either', '20131312955', '^(10|15|17|20)[0-9]{9}$', 'ruc', null, 20),
  ('es_nif', 'ES', 'NIF / DNI', 'person', '12345678Z', '^[0-9]{8}[A-Z]$', 'nif', null, 10),
  ('es_nie', 'ES', 'NIE', 'person', 'X1234567L', '^[XYZ][0-9]{7}[A-Z]$', 'nif', 'For foreign residents', 20),
  ('es_cif', 'ES', 'NIF (company)', 'company', 'B12345678', '^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$', 'none', null, 30),
  ('ca_sin', 'CA', 'SIN', 'person', '046 454 286', '^[0-9]{9}$', 'luhn', 'Social Insurance Number', 10),
  ('ca_bn', 'CA', 'Business Number', 'company', '123456789', '^[0-9]{9}$', 'none', null, 20),
  ('nl_bsn', 'NL', 'BSN', 'person', '111222333', '^[0-9]{9}$', 'bsn', 'Burgerservicenummer', 10),
  ('nl_kvk', 'NL', 'KvK number', 'company', '12345678', '^[0-9]{8}$', 'none', 'Chamber of Commerce', 20),
  ('nl_btw', 'NL', 'BTW-id (VAT)', 'company', 'NL123456789B01', '^NL[0-9]{9}B[0-9]{2}$', 'none', null, 30),
  ('in_pan', 'IN', 'PAN', 'either', 'ABCPE1234F', '^[A-Z]{3}[ABCFGHLJPT][A-Z][0-9]{4}[A-Z]$', 'none', 'Permanent Account Number', 10),
  ('in_gstin', 'IN', 'GSTIN', 'company', '27AAPFU0939F1ZV', '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$', 'gstin', null, 20),
  ('ph_tin', 'PH', 'TIN', 'either', '123-456-789-000', '^[0-9]{9}([0-9]{3,5})?$', 'none', 'With the branch code when there is one', 10),
  ('other', null, 'Tax ID', 'either', 'A1234567', '^[A-Z0-9]{4,30}$', 'none', 'For a country not listed', 100);

alter table public.os_tax_id_types enable row level security;
create policy os_tax_id_types_read on public.os_tax_id_types for select to authenticated using (true);
revoke all on public.os_tax_id_types from anon, authenticated;
grant select on public.os_tax_id_types to authenticated;

-- The value as typed, without spaces, dots, dashes or slashes, in capitals.
create or replace function public.tax_id_normal(_v text)
returns text
language sql
immutable
as $function$
  select nullif(upper(regexp_replace(coalesce(_v, ''), '[[:space:]./-]', '', 'g')), '');
$function$;

-- The check-digit rules, on the normalised value.
create or replace function public.tax_id_check(_rule text, _v text)
returns boolean
language plpgsql
immutable
as $function$
declare
  s int := 0;
  r int;
  v int;
  w int[];
  dict text;
  body text;
  m int;
begin
  if _rule = 'none' then
    return true;
  elsif _rule = 'rfc' then
    -- SAT: the last character checks the first 12 (a 13-character RFC).
    dict := '0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ Ñ';
    for i in 1..12 loop
      s := s + (strpos(dict, substr(_v, i, 1)) - 1) * (14 - i);
    end loop;
    v := 11 - s % 11;
    return substr(_v, 13, 1) = case when v = 11 then '0' when v = 10 then 'A' else v::text end;
  elsif _rule = 'nit_co' then
    w := array[3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    body := left(_v, length(_v) - 1);
    for i in 1..length(body) loop
      s := s + substr(body, length(body) - i + 1, 1)::int * w[i];
    end loop;
    r := s % 11;
    return right(_v, 1)::int = case when r < 2 then r else 11 - r end;
  elsif _rule = 'cuit' then
    w := array[5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    for i in 1..10 loop
      s := s + substr(_v, i, 1)::int * w[i];
    end loop;
    v := 11 - s % 11;
    -- A result of 10 is reassigned by AFIP, so such numbers are accepted as they come.
    return v = 10 or right(_v, 1)::int = case when v = 11 then 0 else v end;
  elsif _rule = 'cpf' then
    if _v ~ '^(.)\1*$' then return false; end if;
    for k in 9..10 loop
      s := 0;
      for i in 1..k loop
        s := s + substr(_v, i, 1)::int * (k + 2 - i);
      end loop;
      if (s * 10) % 11 % 10 <> substr(_v, k + 1, 1)::int then return false; end if;
    end loop;
    return true;
  elsif _rule = 'cnpj' then
    if _v ~ '^(.)\1*$' then return false; end if;
    w := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    for k in 12..13 loop
      s := 0;
      for i in 1..k loop
        s := s + substr(_v, i, 1)::int * w[i + 13 - k];
      end loop;
      r := s % 11;
      if (case when r < 2 then 0 else 11 - r end) <> substr(_v, k + 1, 1)::int then return false; end if;
    end loop;
    return true;
  elsif _rule = 'rut' then
    body := left(_v, length(_v) - 1);
    m := 2;
    for i in reverse length(body)..1 loop
      s := s + substr(body, i, 1)::int * m;
      m := case when m = 7 then 2 else m + 1 end;
    end loop;
    v := 11 - s % 11;
    return right(_v, 1) = case when v = 11 then '0' when v = 10 then 'K' else v::text end;
  elsif _rule = 'ruc' then
    w := array[5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    for i in 1..10 loop
      s := s + substr(_v, i, 1)::int * w[i];
    end loop;
    v := 11 - s % 11;
    return right(_v, 1)::int = case when v >= 10 then v - 10 else v end;
  elsif _rule = 'nif' then
    body := translate(left(_v, 8), 'XYZ', '012');
    return right(_v, 1) = substr('TRWAGMYFPDXBNJZSQVHLCKE', (body::bigint % 23)::int + 1, 1);
  elsif _rule = 'luhn' then
    for i in 1..length(_v) loop
      v := substr(_v, length(_v) - i + 1, 1)::int;
      if i % 2 = 0 then
        v := v * 2;
        if v > 9 then v := v - 9; end if;
      end if;
      s := s + v;
    end loop;
    return s % 10 = 0;
  elsif _rule = 'bsn' then
    for i in 1..8 loop
      s := s + substr(_v, i, 1)::int * (10 - i);
    end loop;
    s := s - right(_v, 1)::int;
    return s % 11 = 0;
  elsif _rule = 'gstin' then
    dict := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for i in 1..14 loop
      v := (strpos(dict, substr(_v, i, 1)) - 1) * (case when i % 2 = 1 then 1 else 2 end);
      s := s + v / 36 + v % 36;
    end loop;
    return right(_v, 1) = substr(dict, (36 - s % 36) % 36 + 1, 1);
  end if;
  return false;
end;
$function$;

-- 2. People's tax IDs: one of each type per person, never read directly.
create table public.os_person_tax_ids (
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  type_key text not null references public.os_tax_id_types(key),
  value_enc bytea,
  last4 text check (last4 is null or last4 ~ '^[A-Z0-9Ñ&]{1,4}$'),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (tenant_id, user_id, type_key),
  check ((removed_at is null) = (value_enc is not null and last4 is not null))
);
comment on table public.os_person_tax_ids is
  'A person''s tax IDs, encrypted with os_bank_key. Read through os_tax_ids / os_reveal_tax_id only. Removing clears the value and keeps the row.';
alter table public.os_person_tax_ids enable row level security;
revoke all on public.os_person_tax_ids from anon, authenticated;

-- The masked list, or null for anyone without a reason to see it.
create or replace function public.os_tax_ids(_tenant_id uuid, _user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  self_ boolean;
  reader boolean;
begin
  if me is null then return null; end if;
  self_ := me = _user_id and exists (
    select 1 from public.members m where m.tenant_id = _tenant_id and m.user_id = me and m.user_status = 'active');
  reader := public.os_can_see_bank(_tenant_id);
  if not (self_ or reader) then return null; end if;
  if not exists (select 1 from public.members m where m.tenant_id = _tenant_id and m.user_id = _user_id) then return null; end if;
  return jsonb_build_object(
    'can_edit', self_ or public.is_os_admin(_tenant_id),
    'can_reveal', reader,
    'ids', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type_key', x.type_key, 'label', t.label, 'country_code', t.country_code, 'holder', t.holder,
        'last4', x.last4, 'updated_at', x.updated_at,
        'updated_by_name', nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''))
        order by t.country_code nulls last, t.position)
      from public.os_person_tax_ids x
      join public.os_tax_id_types t on t.key = x.type_key
      left join public.profiles p on p.user_id = x.updated_by
      where x.tenant_id = _tenant_id and x.user_id = _user_id and x.removed_at is null), '[]'::jsonb));
end;
$function$;
revoke all on function public.os_tax_ids(uuid, uuid) from public, anon;
grant execute on function public.os_tax_ids(uuid, uuid) to authenticated;

create or replace function public.os_reveal_tax_id(_tenant_id uuid, _user_id uuid, _type_key text)
returns text
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  enc bytea;
begin
  if auth.uid() is null then
    raise exception 'Sign in to do this.' using errcode = 'GTX01';
  end if;
  if not public.os_can_see_bank(_tenant_id) then
    raise exception 'Only admins and Billing can see full tax IDs.' using errcode = 'GTX01';
  end if;
  select x.value_enc into enc from public.os_person_tax_ids x
  where x.tenant_id = _tenant_id and x.user_id = _user_id and x.type_key = _type_key and x.removed_at is null;
  if enc is null then
    raise exception 'This person has no such tax ID on record.' using errcode = 'GTX02';
  end if;
  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (_tenant_id, auth.uid(), _user_id, 'person.tax_id_revealed', jsonb_build_object('type', _type_key));
  return extensions.pgp_sym_decrypt(enc, public.os_bank_key());
end;
$function$;
revoke all on function public.os_reveal_tax_id(uuid, uuid, text) from public, anon;
grant execute on function public.os_reveal_tax_id(uuid, uuid, text) to authenticated;

-- Who may change a person's tax IDs: the person, or a People & Access admin.
create or replace function public.os_tax_id_guard(_tenant_id uuid, _user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Sign in to do this.' using errcode = 'GTX01';
  end if;
  if not exists (select 1 from public.members m where m.tenant_id = _tenant_id and m.user_id = _user_id) then
    raise exception 'This person is not a member of the workspace.' using errcode = 'GTX02';
  end if;
  if not (public.is_os_admin(_tenant_id) or (auth.uid() = _user_id and exists (
      select 1 from public.members m where m.tenant_id = _tenant_id and m.user_id = auth.uid() and m.user_status = 'active'))) then
    raise exception 'Only admins and the person themself can change tax IDs.' using errcode = 'GTX01';
  end if;
end;
$function$;
revoke all on function public.os_tax_id_guard(uuid, uuid) from public, anon, authenticated;

-- Someone else changed their tax IDs: the person hears about it at once.
create or replace function public.os_tax_id_bell(_tenant_id uuid, _user_id uuid, _label text, _removed boolean)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  who text;
begin
  if auth.uid() is null or auth.uid() = _user_id then return; end if;
  select nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '') into who
  from public.profiles p where p.user_id = auth.uid();
  insert into public.notifications (user_id, tenant_id, category, actor_user_id, actor_name, title, subtitle,
                                    entity_kind, entity_id, action_url, metadata)
  values (_user_id, _tenant_id, 'account'::public.notification_category, auth.uid(), who,
          case when _removed then 'Your ' || _label || ' was removed' else 'Your ' || _label || ' was changed' end,
          coalesce(who, 'An admin') || case when _removed then ' removed it from your profile.' else ' updated it on your profile.' end,
          'person', _user_id, '/me',
          jsonb_build_object('kind', case when _removed then 'tax_id_removed' else 'tax_id_changed' end));
end;
$function$;
revoke all on function public.os_tax_id_bell(uuid, uuid, text, boolean) from public, anon, authenticated;

create or replace function public.os_save_tax_id(_tenant_id uuid, _user_id uuid, _type_key text, _value text)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  t public.os_tax_id_types%rowtype;
  v text := public.tax_id_normal(_value);
  old_ public.os_person_tax_ids%rowtype;
  same boolean := false;
begin
  perform public.os_tax_id_guard(_tenant_id, _user_id);
  select * into t from public.os_tax_id_types where key = _type_key;
  if t.key is null then
    raise exception 'Choose which tax ID this is.' using errcode = 'GTX02';
  end if;
  if v is null then
    raise exception 'Enter the %.', t.label using errcode = 'GTX02';
  end if;
  if v !~ t.pattern then
    raise exception 'This doesn''t look like a %. For example: %.', t.label, t.example using errcode = 'GTX02';
  end if;
  if not public.tax_id_check(t.check_rule, v) then
    raise exception 'This % doesn''t add up: check the characters.', t.label using errcode = 'GTX02';
  end if;

  select * into old_ from public.os_person_tax_ids x
  where x.tenant_id = _tenant_id and x.user_id = _user_id and x.type_key = _type_key for update;
  if old_.value_enc is not null then
    same := extensions.pgp_sym_decrypt(old_.value_enc, public.os_bank_key()) = v;
  end if;
  if same then return; end if;

  insert into public.os_person_tax_ids as x (tenant_id, user_id, type_key, value_enc, last4, updated_by, updated_at, removed_at)
  values (_tenant_id, _user_id, _type_key, extensions.pgp_sym_encrypt(v, public.os_bank_key()), right(v, 4), auth.uid(), now(), null)
  on conflict (tenant_id, user_id, type_key) do update set
    value_enc = excluded.value_enc, last4 = excluded.last4, updated_by = excluded.updated_by,
    updated_at = excluded.updated_at, removed_at = null;

  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (_tenant_id, auth.uid(), _user_id, 'person.tax_id_updated',
          jsonb_build_object('type', _type_key, 'added', old_.value_enc is null));
  perform public.os_tax_id_bell(_tenant_id, _user_id, t.label, false);
end;
$function$;
revoke all on function public.os_save_tax_id(uuid, uuid, text, text) from public, anon;
grant execute on function public.os_save_tax_id(uuid, uuid, text, text) to authenticated;

create or replace function public.os_remove_tax_id(_tenant_id uuid, _user_id uuid, _type_key text)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  n int;
  lbl text;
begin
  perform public.os_tax_id_guard(_tenant_id, _user_id);
  update public.os_person_tax_ids set value_enc = null, last4 = null, removed_at = now(), updated_by = auth.uid(), updated_at = now()
  where tenant_id = _tenant_id and user_id = _user_id and type_key = _type_key and removed_at is null;
  get diagnostics n = row_count;
  if n = 0 then return; end if;
  select label into lbl from public.os_tax_id_types where key = _type_key;
  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (_tenant_id, auth.uid(), _user_id, 'person.tax_id_removed', jsonb_build_object('type', _type_key));
  perform public.os_tax_id_bell(_tenant_id, _user_id, coalesce(lbl, 'tax ID'), true);
end;
$function$;
revoke all on function public.os_remove_tax_id(uuid, uuid, text) from public, anon;
grant execute on function public.os_remove_tax_id(uuid, uuid, text) to authenticated;

-- 3. Useful links.
create table public.os_useful_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  title text not null check (length(title) between 1 and 80),
  description text check (description is null or length(description) <= 200),
  url text not null check (length(url) <= 2000 and url ~* '^https?://[^[:space:]]+$'),
  position int not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
comment on table public.os_useful_links is
  'Links People & Access admins pin for the workspace (My profile home). Archived, never erased.';
create index os_useful_links_tenant on public.os_useful_links (tenant_id, position) where archived_at is null;

create or replace function public.os_useful_links_validate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  new.title := btrim(regexp_replace(coalesce(new.title, ''), '[[:space:]]+', ' ', 'g'));
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.url := btrim(coalesce(new.url, ''));
  if tg_op = 'UPDATE' and new.tenant_id <> old.tenant_id then
    raise exception 'A link can''t move to another workspace.' using errcode = 'GUL01';
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$function$;
create trigger os_useful_links_validate
  before insert or update on public.os_useful_links
  for each row execute function public.os_useful_links_validate();

create or replace function public.os_useful_links_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  what text;
begin
  what := case
    when tg_op = 'INSERT' then 'link.added'
    when new.archived_at is not null and old.archived_at is null then 'link.archived'
    when new.archived_at is null and old.archived_at is not null then 'link.restored'
    when new.title is distinct from old.title or new.url is distinct from old.url or new.description is distinct from old.description then 'link.updated'
    else null end;
  if what is null then return new; end if;
  insert into public.os_audit_log (tenant_id, actor_id, action, detail)
  values (new.tenant_id, auth.uid(), what, jsonb_build_object('title', new.title, 'url', new.url));
  return new;
end;
$function$;
create trigger os_useful_links_audit
  after insert or update on public.os_useful_links
  for each row execute function public.os_useful_links_audit();

alter table public.os_useful_links enable row level security;
create policy os_useful_links_read on public.os_useful_links for select to authenticated
  using (public.is_os_admin(tenant_id) or (archived_at is null and public.user_has_active_tenant_membership(tenant_id)));
create policy os_useful_links_insert on public.os_useful_links for insert to authenticated
  with check (public.is_os_admin(tenant_id));
create policy os_useful_links_update on public.os_useful_links for update to authenticated
  using (public.is_os_admin(tenant_id)) with check (public.is_os_admin(tenant_id));
revoke all on public.os_useful_links from anon, authenticated;
grant select, insert, update on public.os_useful_links to authenticated;
