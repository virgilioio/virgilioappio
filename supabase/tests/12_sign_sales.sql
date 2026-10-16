-- Gio Sign: sending and managing from Gio Sales (build step 12). Rolled back
-- by the final raise exception; read the RESULT line. Expected values are in
-- the comments.

do $t$
declare
  ten uuid; adm uuid;
  tpl uuid := gen_random_uuid(); d1 uuid := gen_random_uuid(); r1 uuid := gen_random_uuid(); r2 uuid := gen_random_uuid();
  org uuid := gen_random_uuid(); deal uuid := gen_random_uuid(); comp uuid := gen_random_uuid(); rep uuid := gen_random_uuid();
  env uuid; env2 uuid; res jsonb; n int; s text;
  people jsonb;
  r text := '';
begin
  select m.user_id, m.tenant_id into adm, ten
  from public.members m join public.profiles p on p.user_id = m.user_id
  where lower(p.email) = 'allan@virgilio.tech' and m.user_status = 'active' limit 1;

  -- An admin saves a Gio Sales template: the client signs, Allan countersigns.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'allan@virgilio.tech')::text, true);
  set local role authenticated;
  perform public.sign_save_template(jsonb_build_object(
    'id', tpl, 'tenant_id', ten, 'name', 'TEST MSA', 'description', '', 'kind', 'customer', 'app', 'sales',
    'ordered', true, 'subject', 'MSA for {{company}}', 'body', 'Hi {{contact}}', 'reminder_days', 2, 'expiry_days', 14,
    'docs', jsonb_build_array(jsonb_build_object('id', d1, 'name', 'msa.pdf', 'storage_path', ten || '/templates/' || tpl || '/msa.pdf',
      'page_count', 1, 'page_sizes', '[{"w":612,"h":792}]'::jsonb, 'size_bytes', 2809, 'sha256', null)),
    'roles', jsonb_build_array(
      jsonb_build_object('id', r1, 'label', 'Client', 'role', 'signer', 'fixed', false, 'name', '', 'email', '', 'color', '#D7C5FB'),
      jsonb_build_object('id', r2, 'label', 'Countersigner', 'role', 'signer', 'fixed', true, 'name', 'Allan Bravo', 'email', 'allan@virgilio.tech', 'color', '#BFE3CF')),
    'fields', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'type', 'signature', 'rid', r1, 'page', 0, 'x', 12, 'y', 75, 'w', 30, 'h', 6.2, 'required', true, 'data_key', null),
      jsonb_build_object('id', gen_random_uuid(), 'type', 'signature', 'rid', r2, 'page', 0, 'x', 56, 'y', 75, 'w', 30, 'h', 6.2, 'required', true, 'data_key', null),
      jsonb_build_object('id', gen_random_uuid(), 'type', 'data', 'rid', null, 'page', 0, 'x', 12, 'y', 20, 'w', 26, 'h', 3.6, 'required', true, 'data_key', 'company'),
      jsonb_build_object('id', gen_random_uuid(), 'type', 'data', 'rid', null, 'page', 0, 'x', 12, 'y', 26, 'w', 26, 'h', 3.6, 'required', true, 'data_key', 'fee'))));
  -- Members can't call the gateway's functions.
  begin
    perform public.sign_send_sales(tpl, org, deal, comp, 'x', rep, 'Rep', 'rep@virgilio.tech', '{}', '[]');
    r := 'user_send=ok';
  exception when insufficient_privilege then r := 'user_send=denied'; end;      -- denied
  reset role;

  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  people := jsonb_build_array(jsonb_build_object('role_id', r1, 'name', 'Hannah Cole', 'email', 'Hannah@Northwind.test'));
  begin
    perform public.sign_send_sales(tpl, org, deal, comp, 'Northwind · Backend hiring', rep, 'Rita Rep', 'rita@virgilio.tech',
      '{"company":"Northwind Labs"}', people);
    r := r || ' missing=ok';
  exception when sqlstate 'GSN14' then r := r || ' missing=GSN14'; end;         -- GSN14 (fee)

  env := public.sign_send_sales(tpl, org, deal, comp, 'Northwind · Backend hiring', rep, 'Rita Rep', 'Rita@virgilio.tech',
    '{"company":"Northwind Labs","fee":"18%","bogus":"x"}', people);
  select status::text || '/' || origin || '/' || kind::text || '/' || (sender_user_id is null) || '/' || sender_email || '/' || title
    into s from public.sign_envelopes where id = env;
  r := r || ' sent=' || s;                    -- queued/sales/customer/true/rita@virgilio.tech/TEST MSA · Northwind Labs
  select count(*) into n from public.sign_recipients where envelope_id = env;
  select string_agg(value, ',' order by data_key) into s from public.sign_fields where envelope_id = env and type = 'data';
  r := r || ' people=' || n || ' values=' || s;                                 -- 2 values=Northwind Labs,18%
  select (data_snapshot ? 'bogus')::text || '/' || (data_snapshot->>'sender') into s from public.sign_envelopes where id = env;
  r := r || ' snapshot=' || s;                                                  -- false/Rita Rep
  select actor_name into s from public.sign_events where envelope_id = env and kind = 'queued';
  r := r || ' actor=' || s;                                                     -- Rita Rep

  set constraints public.sign_events_z_to_sales immediate;
  select count(*) into n from public.integration_outbox where payload->>'envelope_id' = env::text;
  select string_agg(event, ',' order by event) into s from public.integration_outbox where payload->>'envelope_id' = env::text;
  r := r || ' outbox=' || n || ':' || s;                                        -- 2:sign.created,sign.queued
  select (payload->>'deal_id' = deal::text) || '/' || (payload->>'org_id' = org::text) || '/' || (payload->>'signers_total')
    into s from public.integration_outbox where idempotency_key like 'sign_%' and payload->>'envelope_id' = env::text and event = 'sign.queued';
  r := r || ' payload=' || s;                                                   -- true/true/2

  -- Wrong workspace, then Undo send (deferred again, as in a real request).
  set constraints public.sign_events_z_to_sales deferred;
  begin
    perform public.sign_sales_manage(env, gen_random_uuid(), 'undo', null, 'Rita Rep', 'rita@virgilio.tech');
    r := r || ' wrong_org=ok';
  exception when sqlstate 'GSN07' then r := r || ' wrong_org=GSN07'; end;      -- GSN07
  res := public.sign_sales_manage(env, org, 'undo', null, 'Rita Rep', 'rita@virgilio.tech');
  select status::text || '/' || (deleted_at is not null) into s from public.sign_envelopes where id = env;
  r := r || ' undo=' || (res->>'ok') || ':' || s;                               -- true:draft/true
  set constraints public.sign_events_z_to_sales immediate;
  select payload->>'deleted' into s from public.integration_outbox where payload->>'envelope_id' = env::text and event = 'sign.send_undone';
  r := r || ' undo_event_deleted=' || s;                                        -- true

  -- A second one, out for signature: remind, then void.
  env2 := public.sign_send_sales(tpl, org, deal, comp, 'Northwind', rep, 'Rita Rep', 'rita@virgilio.tech',
    '{"company":"Northwind Labs","fee":"18%"}', people);
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes set status = 'sent', sent_at = now(), dispatch_at = null, expires_at = now() + interval '14 days' where id = env2;
  update public.sign_recipients set status = 'sent' where envelope_id = env2 and position = 1;
  insert into public.sign_recipient_secrets (recipient_id, token_hash, token_issued_at)
  select id, 'TEST-' || id, now() from public.sign_recipients where envelope_id = env2 and position = 1;
  perform set_config('gio.sign_rpc', '', true);
  res := public.sign_sales_manage(env2, org, 'remind', null, 'Rita Rep', 'rita@virgilio.tech');
  r := r || ' remind=' || jsonb_array_length(res->'recipients');                -- 1
  res := public.sign_sales_manage(env2, org, 'void', 'Wrong fee, a new one follows', 'Rita Rep', 'rita@virgilio.tech');
  select status::text into s from public.sign_envelopes where id = env2;
  r := r || ' void=' || jsonb_array_length(res->'recipients') || ':' || s;      -- 1:voided
  select actor_name into s from public.sign_events where envelope_id = env2 and kind = 'voided';
  r := r || ' void_actor=' || coalesce(s, 'null');                              -- Rita Rep
  set constraints public.sign_events_z_to_sales immediate;
  select payload->>'status' || '/' || (payload->>'reason') into s from public.integration_outbox
  where payload->>'envelope_id' = env2::text and event = 'sign.voided';
  r := r || ' void_event=' || s;                                                -- voided/Wrong fee, a new one follows

  -- Without the gateway's context, the service role can't manage a Sales envelope directly.
  perform set_config('gio.sign_sales_manage', '', true);
  r := r || ' direct=' || public.sign_can_manage_envelope(env2);                -- false

  raise exception 'RESULT %', r;
end;
$t$;
