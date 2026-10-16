-- Gio Sign: field text size (template editor). Rolled back by the final raise
-- exception; read the RESULT line. Expected values are in the comments.

do $t$
declare
  ten uuid; adm uuid;
  tpl uuid := gen_random_uuid(); d1 uuid := gen_random_uuid(); r1 uuid := gen_random_uuid();
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid(); f3 uuid := gen_random_uuid(); f4 uuid := gen_random_uuid();
  env uuid; s text;
  r text := '';
begin
  select m.user_id, m.tenant_id into adm, ten
  from public.members m join public.profiles p on p.user_id = m.user_id
  where lower(p.email) = 'allan@virgilio.tech' and m.user_status = 'active' limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'allan@virgilio.tech')::text, true);
  set local role authenticated;
  perform public.sign_save_template(jsonb_build_object(
    'id', tpl, 'tenant_id', ten, 'name', 'TEST sizes', 'description', '', 'kind', 'customer', 'app', 'sales',
    'ordered', true, 'subject', 'S', 'body', 'B', 'reminder_days', 2, 'expiry_days', 14,
    'docs', jsonb_build_array(jsonb_build_object('id', d1, 'name', 'a.pdf', 'storage_path', ten || '/templates/' || tpl || '/a.pdf',
      'page_count', 1, 'page_sizes', '[{"w":612,"h":792}]'::jsonb, 'size_bytes', 2809, 'sha256', null)),
    'roles', jsonb_build_array(jsonb_build_object('id', r1, 'label', 'Client', 'role', 'signer', 'fixed', false, 'name', '', 'email', '', 'color', '#D7C5FB')),
    'fields', jsonb_build_array(
      jsonb_build_object('id', f1, 'type', 'signature', 'rid', r1, 'page', 0, 'x', 12, 'y', 75, 'w', 30, 'h', 6.2, 'required', true, 'data_key', null, 'font_size', 12),
      jsonb_build_object('id', f2, 'type', 'text', 'rid', r1, 'page', 0, 'x', 12, 'y', 60, 'w', 30, 'h', 3.6, 'required', false, 'data_key', null, 'font_size', 10.25),
      jsonb_build_object('id', f3, 'type', 'data', 'rid', null, 'page', 0, 'x', 12, 'y', 20, 'w', 26, 'h', 3.6, 'required', true, 'data_key', 'company', 'font_size', 40),
      jsonb_build_object('id', f4, 'type', 'name', 'rid', r1, 'page', 0, 'x', 12, 'y', 30, 'w', 26, 'h', 3.6, 'required', true, 'data_key', null))));
  reset role;
  select string_agg(type || ':' || coalesce(font_size::text, 'null'), ' ' order by type) into s
  from public.sign_fields where template_id = tpl and envelope_id is null;
  r := 'saved=' || s;                                        -- data:24.0 name:null signature:null text:10.5

  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  env := public.sign_send_sales(tpl, gen_random_uuid(), gen_random_uuid(), null, 'X', gen_random_uuid(), 'Rep', 'rep@virgilio.tech',
    '{"company":"Northwind"}', jsonb_build_array(jsonb_build_object('role_id', r1, 'name', 'Hannah', 'email', 'h@example.com')));
  select string_agg(type || ':' || coalesce(font_size::text, 'null'), ' ' order by type) into s
  from public.sign_fields where envelope_id = env;
  r := r || ' copied=' || s;                                 -- data:24.0 name:null signature:null text:10.5

  raise exception 'RESULT %', r;
end;
$t$;
