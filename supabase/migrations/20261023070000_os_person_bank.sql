-- Member profile, step 5: bank details (Allan, 2026-10-23).
--
-- Virgilio pays commissions by bank transfer, so each person keeps one bank
-- account on record: a Mexican CLABE, a US account (routing and account
-- number) or an account anywhere else (IBAN or account number with SWIFT).
--
-- Who sees what:
--   - People & Access admins and Billing (an active Gio Sales Billing role in
--     People & Access) read the masked details and may reveal the full
--     account number. Every reveal is in the person's history: who, when,
--     which field, never the number.
--   - The person adds and replaces their own, and afterwards sees only the
--     masked number. Admins may edit too, and Billing reads only.
--   - Anyone else reads nothing, not even that bank details exist.
--
-- How it's kept: the account number is encrypted (pgcrypto, with a key held
-- in Supabase Vault and never in the repo), and the last four digits are kept
-- apart for the masked view. Nobody reads the table directly: screens go
-- through os_bank_details() (masked), os_reveal_bank_account() and
-- os_save_bank_details(). Bank codes, routing numbers and SWIFT codes name
-- banks, not people, and are stored as they are.
--
-- Fraud guard: when anyone other than the person changes their bank details,
-- the person's bell rings and an email is queued (os_bank_alerts, sent by
-- os-sync, which runs every five minutes).
--
-- Checks: a CLABE's check digit, a US routing number's checksum, an IBAN's
-- mod-97 and the SWIFT format, so a typo never reaches a transfer.

-- 1. The key, generated here and kept in Vault (never written to the repo).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'os_bank_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'os_bank_key',
      'Encrypts bank account numbers in os_person_bank (Gio ATS).');
  end if;
end $$;

create or replace function public.os_bank_key()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select decrypted_secret from vault.decrypted_secrets where name = 'os_bank_key' limit 1;
$function$;
revoke all on function public.os_bank_key() from public, anon, authenticated;

-- 2. Number checks.
create or replace function public.clabe_valid(_c text)
returns boolean
language plpgsql
immutable
as $function$
declare
  w int[] := array[3, 7, 1];
  s int := 0;
begin
  if _c is null or _c !~ '^[0-9]{18}$' then return false; end if;
  for i in 1..17 loop
    s := s + (substr(_c, i, 1)::int * w[((i - 1) % 3) + 1]) % 10;
  end loop;
  return (10 - s % 10) % 10 = substr(_c, 18, 1)::int;
end;
$function$;

create or replace function public.aba_routing_valid(_r text)
returns boolean
language plpgsql
immutable
as $function$
declare
  d int[];
begin
  if _r is null or _r !~ '^[0-9]{9}$' then return false; end if;
  d := array(select substr(_r, i, 1)::int from generate_series(1, 9) i);
  return (3 * (d[1] + d[4] + d[7]) + 7 * (d[2] + d[5] + d[8]) + (d[3] + d[6] + d[9])) % 10 = 0;
end;
$function$;

create or replace function public.iban_valid(_iban text)
returns boolean
language plpgsql
immutable
as $function$
declare
  s text;
  r int := 0;
  ch text;
  v int;
begin
  if _iban is null or _iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then return false; end if;
  s := substr(_iban, 5) || substr(_iban, 1, 4);
  for i in 1..length(s) loop
    ch := substr(s, i, 1);
    if ch ~ '[0-9]' then
      r := (r * 10 + ch::int) % 97;
    else
      v := ascii(ch) - 55;
      r := (r * 100 + v) % 97;
    end if;
  end loop;
  return r = 1;
end;
$function$;

-- The bank behind a CLABE (its first three digits). Unknown codes ask for the name.
create or replace function public.clabe_bank(_c text)
returns text
language sql
immutable
as $function$
  select case left(_c, 3)
    when '002' then 'Citibanamex'
    when '012' then 'BBVA México'
    when '014' then 'Santander'
    when '021' then 'HSBC'
    when '030' then 'BanBajío'
    when '036' then 'Inbursa'
    when '042' then 'Mifel'
    when '044' then 'Scotiabank'
    when '058' then 'Banregio'
    when '059' then 'Invex'
    when '062' then 'Afirme'
    when '072' then 'Banorte'
    when '127' then 'Banco Azteca'
    when '130' then 'Compartamos'
    when '132' then 'Multiva'
    when '133' then 'Actinver'
    when '137' then 'BanCoppel'
    when '143' then 'CIBanco'
    when '156' then 'Sabadell'
    when '166' then 'Banco del Bienestar'
    when '638' then 'Nu México'
    when '646' then 'STP'
    when '699' then 'Fondeadora'
    when '722' then 'Mercado Pago'
    when '728' then 'Spin by OXXO'
  end;
$function$;

-- 3. The table. One account per person per workspace, never read directly.
create table public.os_person_bank (
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  kind text not null check (kind in ('mx_clabe', 'us_account', 'intl')),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  holder_name text not null check (length(holder_name) between 2 and 140),
  bank_name text not null check (length(bank_name) between 2 and 120),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  account_label text not null check (account_label in ('CLABE', 'Account number', 'IBAN')),
  account_enc bytea not null,
  account_last4 text not null check (account_last4 ~ '^[A-Z0-9]{4}$'),
  routing_number text check (routing_number is null or routing_number ~ '^[0-9]{9}$'),
  account_type text check (account_type is null or account_type in ('checking', 'savings')),
  swift text check (swift is null or swift ~ '^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$'),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

comment on table public.os_person_bank is
  'Where a person is paid: one bank account per person per workspace. The account number is encrypted, read through os_bank_details / os_reveal_bank_account only.';

alter table public.os_person_bank enable row level security;
revoke all on public.os_person_bank from anon, authenticated;

-- 4. Alerts waiting to be emailed (the bell rings at once).
create table public.os_bank_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  changed_by uuid,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text
);
alter table public.os_bank_alerts enable row level security;
revoke all on public.os_bank_alerts from anon, authenticated;

-- The bell's category for changes to your own account.
alter type public.notification_category add value if not exists 'account';

-- 5. Who may see and reveal: People & Access admins and active Billing.
create or replace function public.os_can_see_bank(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null and (
    public.is_os_admin(_tenant_id)
    or exists (
      select 1
      from public.os_app_grants g
      join public.members m on m.tenant_id = g.tenant_id and m.user_id = g.user_id and m.user_status = 'active'
      where g.tenant_id = _tenant_id and g.user_id = auth.uid()
        and g.app_key = 'sales' and g.role = 'billing' and g.status = 'active'
    )
  );
$function$;
revoke all on function public.os_can_see_bank(uuid) from public, anon;
grant execute on function public.os_can_see_bank(uuid) to authenticated;

-- 6. The masked view. Nothing at all for anyone without a reason to see it.
create or replace function public.os_bank_details(_tenant_id uuid, _user_id uuid)
returns table(
  has_details boolean, kind text, country_code text, holder_name text, bank_name text, currency text,
  account_label text, account_last4 text, routing_number text, account_type text, swift text,
  updated_at timestamptz, updated_by_name text, can_edit boolean, can_reveal boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  self_ boolean;
  reader boolean;
  admin_ boolean;
begin
  if me is null then return; end if;
  self_ := me = _user_id and exists (
    select 1 from public.members m where m.tenant_id = _tenant_id and m.user_id = me and m.user_status = 'active');
  reader := public.os_can_see_bank(_tenant_id);
  admin_ := public.is_os_admin(_tenant_id);
  if not (self_ or reader) then return; end if;
  if not exists (select 1 from public.members m where m.tenant_id = _tenant_id and m.user_id = _user_id) then return; end if;

  return query
  select
    b.user_id is not null,
    b.kind, b.country_code, b.holder_name, b.bank_name, b.currency,
    b.account_label, b.account_last4, b.routing_number, b.account_type, b.swift,
    b.updated_at,
    nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
    self_ or admin_,
    reader
  from (select 1) one
  left join public.os_person_bank b on b.tenant_id = _tenant_id and b.user_id = _user_id
  left join public.profiles p on p.user_id = b.updated_by;
end;
$function$;
revoke all on function public.os_bank_details(uuid, uuid) from public, anon;
grant execute on function public.os_bank_details(uuid, uuid) to authenticated;

-- 7. Reveal: the full number for admins and Billing, written to the history.
create or replace function public.os_reveal_bank_account(_tenant_id uuid, _user_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  enc bytea;
  label text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to do this.' using errcode = 'GBK01';
  end if;
  if not public.os_can_see_bank(_tenant_id) then
    raise exception 'Only admins and Billing can see bank account numbers.' using errcode = 'GBK01';
  end if;
  select b.account_enc, b.account_label into enc, label
  from public.os_person_bank b where b.tenant_id = _tenant_id and b.user_id = _user_id;
  if enc is null then
    raise exception 'This person has no bank details yet.' using errcode = 'GBK02';
  end if;
  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (_tenant_id, auth.uid(), _user_id, 'person.bank_revealed', jsonb_build_object('field', label));
  return extensions.pgp_sym_decrypt(enc, public.os_bank_key());
end;
$function$;
revoke all on function public.os_reveal_bank_account(uuid, uuid) from public, anon;
grant execute on function public.os_reveal_bank_account(uuid, uuid) to authenticated;

-- 8. Save: the person or an admin. A blank account number keeps the current
-- one (same kind of account only), so fixing a name never means retyping it.
create or replace function public.os_save_bank_details(
  _tenant_id uuid,
  _user_id uuid,
  _kind text,
  _holder_name text,
  _bank_name text,
  _account text,
  _currency text default null,
  _country_code text default null,
  _routing_number text default null,
  _account_type text default null,
  _swift text default null)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  old_ public.os_person_bank%rowtype;
  acct text := nullif(upper(regexp_replace(coalesce(_account, ''), '[[:space:]-]', '', 'g')), '');
  old_acct text;
  holder text := nullif(btrim(regexp_replace(coalesce(_holder_name, ''), '[[:space:]]+', ' ', 'g')), '');
  bank text := nullif(btrim(coalesce(_bank_name, '')), '');
  cur text := nullif(upper(btrim(coalesce(_currency, ''))), '');
  country text := nullif(upper(btrim(coalesce(_country_code, ''))), '');
  routing text := nullif(regexp_replace(coalesce(_routing_number, ''), '[^0-9]', '', 'g'), '');
  atype text := nullif(lower(btrim(coalesce(_account_type, ''))), '');
  swift_ text := nullif(upper(regexp_replace(coalesce(_swift, ''), '[[:space:]]', '', 'g')), '');
  label text;
  changed text[] := '{}';
  who text;
begin
  if me is null then
    raise exception 'Sign in to do this.' using errcode = 'GBK01';
  end if;
  if not exists (select 1 from public.members m where m.tenant_id = _tenant_id and m.user_id = _user_id) then
    raise exception 'This person is not a member of the workspace.' using errcode = 'GBK02';
  end if;
  if not (public.is_os_admin(_tenant_id) or (me = _user_id and exists (
      select 1 from public.members m where m.tenant_id = _tenant_id and m.user_id = me and m.user_status = 'active'))) then
    raise exception 'Only admins and the person themself can change bank details.' using errcode = 'GBK01';
  end if;

  select * into old_ from public.os_person_bank b where b.tenant_id = _tenant_id and b.user_id = _user_id for update;
  if acct is null then
    if old_.user_id is null or old_.kind is distinct from _kind then
      raise exception 'Add the account number.' using errcode = 'GBK02';
    end if;
    old_acct := extensions.pgp_sym_decrypt(old_.account_enc, public.os_bank_key());
    acct := old_acct;
  elsif old_.user_id is not null then
    old_acct := extensions.pgp_sym_decrypt(old_.account_enc, public.os_bank_key());
  end if;

  if holder is null or length(holder) < 2 then
    raise exception 'Add the account holder''s name, as the bank has it.' using errcode = 'GBK02';
  end if;

  if _kind = 'mx_clabe' then
    if acct !~ '^[0-9]{18}$' then
      raise exception 'A CLABE has 18 digits.' using errcode = 'GBK02';
    end if;
    if not public.clabe_valid(acct) then
      raise exception 'This CLABE doesn''t add up: check the digits.' using errcode = 'GBK02';
    end if;
    country := 'MX';
    label := 'CLABE';
    bank := coalesce(bank, public.clabe_bank(acct));
    cur := coalesce(cur, 'MXN');
    routing := null; atype := null; swift_ := null;
  elsif _kind = 'us_account' then
    if routing is null or not public.aba_routing_valid(routing) then
      raise exception 'This routing number doesn''t add up: it has 9 digits, check them.' using errcode = 'GBK02';
    end if;
    if acct !~ '^[0-9]{4,17}$' then
      raise exception 'A US account number has 4 to 17 digits.' using errcode = 'GBK02';
    end if;
    if atype is null or atype not in ('checking', 'savings') then
      raise exception 'Choose checking or savings.' using errcode = 'GBK02';
    end if;
    country := 'US';
    label := 'Account number';
    cur := coalesce(cur, 'USD');
    swift_ := null;
  elsif _kind = 'intl' then
    if acct ~ '^[A-Z]{2}[0-9]{2}' and length(acct) >= 15 then
      if not public.iban_valid(acct) then
        raise exception 'This IBAN doesn''t add up: check the characters.' using errcode = 'GBK02';
      end if;
      label := 'IBAN';
      country := coalesce(country, left(acct, 2));
    elsif acct ~ '^[A-Z0-9]{4,34}$' then
      label := 'Account number';
    else
      raise exception 'Enter the IBAN or the account number, letters and digits only.' using errcode = 'GBK02';
    end if;
    if swift_ is null or swift_ !~ '^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$' then
      raise exception 'Add the bank''s SWIFT/BIC code: 8 or 11 letters and digits.' using errcode = 'GBK02';
    end if;
    if country is null or country !~ '^[A-Z]{2}$' then
      raise exception 'Choose the country the account is in.' using errcode = 'GBK02';
    end if;
    if cur is null or cur !~ '^[A-Z]{3}$' then
      raise exception 'Choose the account''s currency.' using errcode = 'GBK02';
    end if;
    routing := null; atype := null;
  else
    raise exception 'Choose where the account is: Mexico, the US or another country.' using errcode = 'GBK02';
  end if;

  if bank is null or length(bank) < 2 then
    raise exception 'Add the bank''s name.' using errcode = 'GBK02';
  end if;
  if length(holder) > 140 or length(bank) > 120 then
    raise exception 'That name is too long.' using errcode = 'GBK02';
  end if;

  -- What changed, by field name only.
  if old_.user_id is null then
    changed := array['bank_details'];
  else
    if old_.kind is distinct from _kind then changed := array_append(changed, 'kind'); end if;
    if old_.holder_name is distinct from holder then changed := array_append(changed, 'holder_name'); end if;
    if old_.bank_name is distinct from bank then changed := array_append(changed, 'bank_name'); end if;
    if old_acct is distinct from acct then changed := array_append(changed, lower(replace(label, ' ', '_'))); end if;
    if old_.currency is distinct from cur then changed := array_append(changed, 'currency'); end if;
    if old_.country_code is distinct from country then changed := array_append(changed, 'country'); end if;
    if old_.routing_number is distinct from routing then changed := array_append(changed, 'routing_number'); end if;
    if old_.account_type is distinct from atype then changed := array_append(changed, 'account_type'); end if;
    if old_.swift is distinct from swift_ then changed := array_append(changed, 'swift'); end if;
  end if;
  if cardinality(changed) = 0 then
    return;
  end if;

  insert into public.os_person_bank as b (tenant_id, user_id, kind, country_code, holder_name, bank_name, currency,
    account_label, account_enc, account_last4, routing_number, account_type, swift, updated_by, updated_at)
  values (_tenant_id, _user_id, _kind, country, holder, bank, cur,
    label, extensions.pgp_sym_encrypt(acct, public.os_bank_key()), right(acct, 4), routing, atype, swift_, me, now())
  on conflict (tenant_id, user_id) do update set
    kind = excluded.kind, country_code = excluded.country_code, holder_name = excluded.holder_name,
    bank_name = excluded.bank_name, currency = excluded.currency, account_label = excluded.account_label,
    account_enc = case when old_acct is distinct from acct then excluded.account_enc else b.account_enc end,
    account_last4 = excluded.account_last4, routing_number = excluded.routing_number,
    account_type = excluded.account_type, swift = excluded.swift,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (_tenant_id, me, _user_id, 'person.bank_updated', jsonb_build_object('fields', to_jsonb(changed)));

  -- Someone else changed them: tell the person at once (bell) and by email.
  if me <> _user_id then
    select nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '') into who
    from public.profiles p where p.user_id = me;
    insert into public.notifications (user_id, tenant_id, category, actor_user_id, actor_name, title, subtitle,
                                      entity_kind, entity_id, action_url, metadata)
    values (_user_id, _tenant_id, 'account'::public.notification_category, me, who,
            'Your bank details were changed',
            coalesce(who, 'An admin') || ' changed where you''re paid: ' || bank || ' · ' || label || ' •••• ' || right(acct, 4),
            'person', _user_id, '/me?tab=earnings',
            jsonb_build_object('kind', 'bank_changed', 'fields', to_jsonb(changed)));
    insert into public.os_bank_alerts (tenant_id, user_id, changed_by) values (_tenant_id, _user_id, me);
  end if;
end;
$function$;
revoke all on function public.os_save_bank_details(uuid, uuid, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.os_save_bank_details(uuid, uuid, text, text, text, text, text, text, text, text, text) to authenticated;

-- 9. The email side, for os-sync (service role only). A claim holds an alert
-- for ten minutes, and a failure is retried up to five times.
create or replace function public.os_bank_alerts_claim(_limit int default 20)
returns table(alert_id uuid, to_email text, person_name text, changed_by_name text, changed_at timestamptz,
              bank_name text, account_label text, account_last4 text)
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
begin
  return query
  with picked as (
    select a.id from public.os_bank_alerts a
    where a.status = 'pending' and a.attempts < 5
      and (a.claimed_at is null or a.claimed_at < now() - interval '10 minutes')
    order by a.created_at
    limit greatest(1, least(_limit, 100))
    for update skip locked
  ), upd as (
    update public.os_bank_alerts a set claimed_at = now(), attempts = a.attempts + 1
    from picked where a.id = picked.id
    returning a.*
  )
  select upd.id, u.email::text,
    nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
    nullif(btrim(coalesce(cp.first_name, '') || ' ' || coalesce(cp.last_name, '')), ''),
    upd.created_at, b.bank_name, b.account_label, b.account_last4
  from upd
  join auth.users u on u.id = upd.user_id
  left join public.profiles p on p.user_id = upd.user_id
  left join public.profiles cp on cp.user_id = upd.changed_by
  left join public.os_person_bank b on b.tenant_id = upd.tenant_id and b.user_id = upd.user_id;
end;
$function$;
revoke all on function public.os_bank_alerts_claim(int) from public, anon, authenticated;
grant execute on function public.os_bank_alerts_claim(int) to service_role;

create or replace function public.os_bank_alerts_finish(_id uuid, _ok boolean, _error text default null)
returns void
language sql
volatile
security definer
set search_path to 'public'
as $function$
  update public.os_bank_alerts set
    status = case when _ok then 'sent' when attempts >= 5 then 'failed' else 'pending' end,
    sent_at = case when _ok then now() end,
    claimed_at = case when _ok then claimed_at end,
    last_error = case when _ok then null else left(_error, 480) end
  where id = _id;
$function$;
revoke all on function public.os_bank_alerts_finish(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.os_bank_alerts_finish(uuid, boolean, text) to service_role;
