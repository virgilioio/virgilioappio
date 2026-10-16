-- Gio Sign, build step 11: sealing and the signed copy.
--
-- When the last person signs, sign-seal (Edge Function) builds the finished
-- PDF: the documents with every field written in, then a certificate of
-- completion. It seals the file (PAdES: a CAdES detached signature plus an
-- RFC 3161 timestamp), stores it under {tenant}/envelopes/{id}/sealed/, and
-- emails it with the certificate to everyone on the envelope, copies
-- included. A candidate's copy also goes into the candidate's files.
--
-- It runs right after the last signature and every two minutes as a retry,
-- at most five attempts. An admin can start the attempts again.
--
-- Until the cloud signing service is bought, the seal uses a test identity
-- ("Gio Sign (test)") generated once by sign-seal and kept in Vault. Readers
-- show the seal as intact and the signer as not yet trusted.

alter table public.sign_envelopes
  add column if not exists seal_attempts smallint not null default 0,
  add column if not exists seal_claimed_at timestamptz,
  add column if not exists delivered_at timestamptz;

-- ---------------------------------------------------------------------------
-- Claim, done, failed, delivered (service role: sign-seal)
-- ---------------------------------------------------------------------------

-- Completed and not sealed, not being worked on, under five attempts.
-- With an id, only that envelope (the run right after the last signature).
create or replace function public.sign_seal_claim(_envelope_id uuid default null, _limit int default 3)
returns setof uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  with c as (
    select e.id from public.sign_envelopes e
    where e.status = 'completed'
      and e.sealed_path is null
      and e.seal_attempts < 5
      and (e.seal_claimed_at is null or e.seal_claimed_at < now() - interval '10 minutes')
      and (_envelope_id is null or e.id = _envelope_id)
    order by e.completed_at
    limit greatest(1, least(coalesce(_limit, 3), 10))
    for update skip locked
  ), u as (
    update public.sign_envelopes e
       set seal_claimed_at = now(), seal_attempts = e.seal_attempts + 1
      from c
     where e.id = c.id
    returning e.id
  )
  select u.id from u;
end;
$function$;

create or replace function public.sign_seal_done(
  _envelope_id uuid, _sealed_path text, _sha256 text, _certificate_path text, _detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.sign_envelopes
     set sealed_path = _sealed_path, sealed_sha256 = _sha256, certificate_path = _certificate_path,
         seal_error = null, seal_claimed_at = null
   where id = _envelope_id and status = 'completed';
  if not found then
    raise exception 'Only a completed envelope can be sealed.' using errcode = 'GSN30';
  end if;
  perform public.sign_log(_envelope_id, 'sealed', 'Sealed with a digital signature and a timestamp', true,
                          coalesce(_detail, '{}'::jsonb) || jsonb_build_object('sha256', _sha256));
end;
$function$;

-- Returns the attempts used, so the caller knows when it was the last one.
create or replace function public.sign_seal_failed(_envelope_id uuid, _error text)
returns int
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_attempts int;
begin
  update public.sign_envelopes
     set seal_error = left(coalesce(nullif(btrim(_error), ''), 'unknown'), 500), seal_claimed_at = null
   where id = _envelope_id
  returning seal_attempts into v_attempts;
  perform public.sign_log(_envelope_id, 'seal_failed', 'Sealing failed (attempt ' || coalesce(v_attempts, 0) || ' of 5)', false,
                          jsonb_build_object('error', left(coalesce(_error, ''), 500)));
  return coalesce(v_attempts, 0);
end;
$function$;

create or replace function public.sign_mark_delivered(_envelope_id uuid, _count int)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.sign_envelopes set delivered_at = now() where id = _envelope_id and delivered_at is null;
  if found then
    perform public.sign_log(_envelope_id, 'delivered',
      'Signed copy emailed to ' || _count || case when _count = 1 then ' person' else ' people' end, true);
  end if;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Retry (admins): five fresh attempts, picked up within two minutes
-- ---------------------------------------------------------------------------
create or replace function public.sign_seal_retry(_envelope_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  e public.sign_envelopes;
begin
  select * into e from public.sign_envelopes where id = _envelope_id;
  if e.id is null or not public.sign_is_admin(e.tenant_id) then
    raise exception 'Only admins can retry sealing.' using errcode = 'GSN31';
  end if;
  if e.status <> 'completed' or e.sealed_path is not null then
    raise exception 'Only a completed envelope that isn''t sealed yet can be retried.' using errcode = 'GSN30';
  end if;
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes set seal_attempts = 0, seal_error = null, seal_claimed_at = null where id = _envelope_id;
  perform public.sign_log(_envelope_id, 'seal_failed', 'Sealing restarted by ' || coalesce(public.sign_my_email(), 'an admin'), false);
end;
$function$;

-- ---------------------------------------------------------------------------
-- The test signing identity, kept in Vault (service role only)
-- ---------------------------------------------------------------------------
create or replace function public.sign_seal_identity()
returns table (key_pem text, cert_pem text)
language sql
security definer
set search_path to 'public', 'vault'
as $function$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'sign_test_signing_key'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'sign_test_signing_cert');
$function$;

-- Stores the identity the first time; if one is already there, keeps it.
create or replace function public.sign_seal_identity_save(_key_pem text, _cert_pem text)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
begin
  perform pg_advisory_xact_lock(hashtext('sign_test_signing_identity'));
  if exists (select 1 from vault.secrets where name = 'sign_test_signing_key') then
    return false;
  end if;
  perform vault.create_secret(_key_pem, 'sign_test_signing_key', 'Gio Sign test seal: private key (until the signing service)');
  perform vault.create_secret(_cert_pem, 'sign_test_signing_cert', 'Gio Sign test seal: certificate');
  return true;
end;
$function$;

revoke execute on function
  public.sign_seal_claim(uuid, int), public.sign_seal_done(uuid, text, text, text, jsonb),
  public.sign_seal_failed(uuid, text), public.sign_mark_delivered(uuid, int),
  public.sign_seal_identity(), public.sign_seal_identity_save(text, text), public.sign_seal_retry(uuid)
  from public, anon, authenticated;
grant execute on function public.sign_seal_retry(uuid) to authenticated;
grant execute on function
  public.sign_seal_claim(uuid, int), public.sign_seal_done(uuid, text, text, text, jsonb),
  public.sign_seal_failed(uuid, text), public.sign_mark_delivered(uuid, int),
  public.sign_seal_identity(), public.sign_seal_identity_save(text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Reading the sealed files: whoever can see the envelope (its RLS decides)
-- ---------------------------------------------------------------------------
create policy sign_files_sealed_read on storage.objects for select to authenticated
using (
  bucket_id = 'sign-files'
  and (storage.foldername(name))[2] = 'envelopes'
  and (storage.foldername(name))[4] = 'sealed'
  and exists (
    select 1 from public.sign_envelopes e
    where e.id::text = (storage.foldername(name))[3]
      and e.tenant_id::text = (storage.foldername(name))[1]
  )
);

-- ---------------------------------------------------------------------------
-- Retry run every two minutes
-- ---------------------------------------------------------------------------
select cron.schedule(
  'sign-seal',
  '*/2 * * * *',
  $cmd$
  select net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/sign-seal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $cmd$
);
