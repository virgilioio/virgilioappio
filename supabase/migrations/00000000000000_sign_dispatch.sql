-- Gio Sign, build step 8: sending for real.
--
-- 1. sign_claim_due(): every minute the sign-dispatch Edge Function claims
--    the envelopes whose send time has come (queued past their 5-second Undo
--    window, or scheduled and due), marks them sent, starts the expiry clock and
--    opens the first turn (the first person in order, or everyone when order
--    is off).
-- 2. sign_pending_invites() / sign_claim_invite() / sign_release_invite():
--    each person whose turn has opened gets exactly one invitation, even when
--    the minute job and a signer finishing race each other. A failed email is
--    released and retried on the next run.
-- 3. The minute schedule, using the vault secret the other jobs use.
-- All service role only.

create or replace function public.sign_claim_due(_limit int default 50)
returns table (envelope_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  e record;
begin
  perform set_config('gio.sign_rpc', 'on', true);
  for e in
    select x.id, x.tenant_id, x.ordered, x.expiry_days, x.status
    from public.sign_envelopes x
    where x.deleted_at is null
      and ((x.status = 'queued' and x.dispatch_at <= now())
        or (x.status = 'scheduled' and x.scheduled_at <= now()))
    order by coalesce(x.dispatch_at, x.scheduled_at)
    limit greatest(1, least(_limit, 200))
    for update skip locked
  loop
    update public.sign_envelopes
       set status = 'sent', sent_at = now(), dispatch_at = null,
           expires_at = now() + make_interval(days => e.expiry_days)
     where id = e.id;

    update public.sign_recipients r
       set status = 'sent'
     where r.envelope_id = e.id and r.removed_at is null and r.role <> 'cc' and r.status = 'waiting'
       and (not e.ordered or r.position = (
             select min(q.position) from public.sign_recipients q
             where q.envelope_id = e.id and q.removed_at is null and q.role <> 'cc'));

    envelope_id := e.id;
    return next;
  end loop;
end;
$function$;

-- People whose turn is open but who haven't been invited yet (or whose
-- invitation failed and was released).
create or replace function public.sign_pending_invites(_limit int default 100)
returns table (recipient_id uuid, envelope_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, r.envelope_id
  from public.sign_recipients r
  join public.sign_envelopes e on e.id = r.envelope_id
  left join public.sign_recipient_secrets s on s.recipient_id = r.id
  where r.removed_at is null and r.role <> 'cc' and r.status = 'sent'
    and e.status = 'sent' and e.deleted_at is null
    and (s.recipient_id is null or s.token_issued_at is null)
  order by e.sent_at
  limit greatest(1, least(_limit, 500));
$function$;

-- Claim one invitation: stores the new link's hash. False if someone else
-- already sent it.
create or replace function public.sign_claim_invite(_recipient_id uuid, _token_hash text, _expires_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n int;
begin
  insert into public.sign_recipient_secrets (recipient_id, token_hash, token_issued_at, token_expires_at, updated_at)
  values (_recipient_id, _token_hash, now(), _expires_at, now())
  on conflict (recipient_id) do update
     set token_hash = excluded.token_hash, token_issued_at = now(),
         token_expires_at = excluded.token_expires_at, updated_at = now(),
         code_hash = null, code_sent_at = null, code_expires_at = null, code_attempts = 0,
         session_hash = null, session_expires_at = null
   where public.sign_recipient_secrets.token_issued_at is null;
  get diagnostics n = row_count;
  return n > 0;
end;
$function$;

-- The email didn't go out: free the invitation so the next run retries it.
create or replace function public.sign_release_invite(_recipient_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.sign_recipient_secrets
     set token_hash = null, token_issued_at = null, updated_at = now()
   where recipient_id = _recipient_id;
$function$;

revoke execute on function
  public.sign_claim_due(int), public.sign_pending_invites(int),
  public.sign_claim_invite(uuid, text, timestamptz), public.sign_release_invite(uuid)
  from public, anon, authenticated;
grant execute on function
  public.sign_claim_due(int), public.sign_pending_invites(int),
  public.sign_claim_invite(uuid, text, timestamptz), public.sign_release_invite(uuid)
  to service_role;

-- Every minute: send what's due and any invitation still owed.
select cron.schedule(
  'sign-dispatch',
  '* * * * *',
  $cmd$
  select net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/sign-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $cmd$
);
