-- Run after 20261024090000_os_tax_ids_and_links inside a transaction that is rolled back.
-- Every country's rule takes real numbers and refuses a changed digit. A
-- teammate adds their own RFC, sees it masked and can't reveal it. Another
-- member sees nothing. Billing reveals (in the history). An admin's change and
-- removal ring the person's bell. Members read useful links, only admins add
-- them, and an archived link is hidden. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  mate uuid;
  other uuid;
  d jsonb;
  n int;
  st text;
  shown text;
  link uuid;
  good text[] := array[
    'mx_rfc:GODE561231GR8', 'mx_curp:MAHJ280603MSPRRV09', 'mx_rfc_company:ABC680524P76',
    'co_cc:1020304050', 'co_nit:800197268-4', 'co_nit:899999034-1', 'co_nit:860034313-7',
    'us_ssn:123-45-6789', 'us_itin:912-70-1234', 'us_ein:12-3456789',
    'ar_cuil:20-12345678-6', 'ar_cuit:30-50001091-2',
    'br_cpf:529.982.247-25', 'br_cnpj:11.222.333/0001-81', 'br_cnpj:11.444.777/0001-61',
    'cl_rut:12.345.678-5', 'pe_dni:12345678', 'pe_ruc:20131312955', 'pe_ruc:20100047218', 'pe_ruc:10467793549',
    'es_nif:12345678Z', 'es_nie:X1234567L', 'es_nie:Y1234567X', 'es_cif:B12345678',
    'ca_sin:046 454 286', 'ca_sin:130 692 544', 'ca_bn:123456789',
    'nl_bsn:111222333', 'nl_bsn:123456782', 'nl_kvk:12345678', 'nl_btw:NL123456789B01',
    'in_pan:ABCPE1234F', 'in_gstin:27AAPFU0939F1ZV', 'in_gstin:29AAGCB7383J1Z4',
    'ph_tin:123-456-789-000', 'other:A1234567'];
  bad text[] := array[
    'mx_rfc:GODE561231GR9', 'mx_curp:MAHJ280603MXXRRV09', 'co_nit:800197268-5',
    'us_ssn:000-45-6789', 'us_ssn:666-45-6789', 'us_itin:912-93-1234', 'us_ein:00-3456789',
    'ar_cuit:30-50001091-3', 'ar_cuil:30-50001091-2', 'br_cpf:529.982.247-26', 'br_cpf:111.111.111-11',
    'br_cnpj:11.222.333/0001-82', 'cl_rut:12.345.678-K', 'pe_ruc:20131312954', 'pe_ruc:30131312955',
    'es_nif:12345678A', 'es_nie:X1234567M', 'ca_sin:046 454 287', 'nl_bsn:111222334',
    'in_pan:ABCZE1234F', 'in_gstin:27AAPFU0939F1ZW', 'ph_tin:12345678', 'other:A1'];
  x text;
  t public.os_tax_id_types%rowtype;
  v text;
  wrong text := '';
begin
  -- 0. The rules, straight on the catalogue.
  foreach x in array good loop
    select * into t from public.os_tax_id_types where key = split_part(x, ':', 1);
    v := public.tax_id_normal(split_part(x, ':', 2));
    if not (v ~ t.pattern and public.tax_id_check(t.check_rule, v)) then wrong := wrong || ' ' || x; end if;
  end loop;
  insert into t_results values ('real numbers pass in every country:' || wrong, wrong = '');
  wrong := '';
  foreach x in array bad loop
    select * into t from public.os_tax_id_types where key = split_part(x, ':', 1);
    v := public.tax_id_normal(split_part(x, ':', 2));
    if v ~ t.pattern and public.tax_id_check(t.check_rule, v) then wrong := wrong || ' ' || x; end if;
  end loop;
  insert into t_results values ('changed digits and bad formats are refused:' || wrong, wrong = '');
  select count(distinct country_code) into n from public.os_tax_id_types;
  insert into t_results values ('twelve countries are in the catalogue', n = 12);

  select m.user_id into mate from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin' and m.user_id <> allan
  order by m.created_at limit 1;
  select m.user_id into other from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin' and m.user_id not in (allan, mate)
  order by m.created_at limit 1;
  -- Keep "other" out of Billing for section 2, whatever they hold today.
  update public.os_app_grants set status = 'revoked'
  where tenant_id = ten and user_id = other and app_key = 'sales' and role = 'billing' and status <> 'revoked';

  -- 1. The person adds their own RFC. Typed with spaces and lower case, kept clean.
  perform set_config('request.jwt.claims', json_build_object('sub', mate, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.os_save_tax_id(ten, mate, 'mx_rfc', ' gode 561231 gr8 ');
  d := public.os_tax_ids(ten, mate);
  insert into t_results values ('the person adds their own RFC and sees the last four',
    jsonb_array_length(d->'ids') = 1 and d->'ids'->0->>'type_key' = 'mx_rfc' and d->'ids'->0->>'last4' = '1GR8'
    and d->'ids'->0->>'label' = 'RFC' and (d->>'can_edit')::boolean and not (d->>'can_reveal')::boolean);
  begin
    perform public.os_reveal_tax_id(ten, mate, 'mx_rfc');
    insert into t_results values ('the person can''t reveal the full value', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('the person can''t reveal the full value', st = 'GTX01');
  end;
  begin
    perform 1 from public.os_person_tax_ids;
    insert into t_results values ('nobody reads the table directly', false);
  exception when insufficient_privilege then
    insert into t_results values ('nobody reads the table directly', true);
  end;
  begin
    perform public.os_save_tax_id(ten, mate, 'mx_rfc', 'GODE561231GR9');
    insert into t_results values ('a wrong check digit is refused', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('a wrong check digit is refused', st = 'GTX02');
  end;
  select count(*) into n from public.notifications where user_id = mate and category::text = 'account';
  insert into t_results values ('their own change rings no bell', n = 0);

  -- 2. Another member sees nothing and changes nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  insert into t_results values ('another member sees nothing', public.os_tax_ids(ten, mate) is null);
  begin
    perform public.os_save_tax_id(ten, mate, 'mx_curp', 'MAHJ280603MSPRRV09');
    insert into t_results values ('another member can''t add one', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('another member can''t add one', st = 'GTX01');
  end;

  -- 3. Billing reveals, and the reveal is in the history, never the value.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  update public.os_app_grants set role = 'billing', status = 'active'
  where tenant_id = ten and user_id = other and app_key = 'sales';
  if not found then
    insert into public.os_app_grants (tenant_id, user_id, app_key, role, status, granted_by, granted_at)
    values (ten, other, 'sales', 'billing', 'active', allan, now());
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  d := public.os_tax_ids(ten, mate);
  insert into t_results values ('Billing reads the list and may reveal, not edit',
    (d->>'can_reveal')::boolean and not (d->>'can_edit')::boolean);
  shown := public.os_reveal_tax_id(ten, mate, 'mx_rfc');
  insert into t_results values ('Billing reveals the full value', shown = 'GODE561231GR8');
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.os_audit_log
  where tenant_id = ten and subject_user_id = mate and action = 'person.tax_id_revealed' and actor_id = other
    and detail->>'type' = 'mx_rfc' and detail::text not like '%GODE%';
  insert into t_results values ('the reveal is in the history, without the value', n = 1);

  -- 4. An admin adds and removes one: the person hears about both.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.os_save_tax_id(ten, mate, 'mx_curp', 'mahj280603msprrv09');
  perform public.os_save_tax_id(ten, mate, 'mx_curp', 'MAHJ280603MSPRRV09');
  perform public.os_remove_tax_id(ten, mate, 'mx_rfc');
  d := public.os_tax_ids(ten, mate);
  insert into t_results values ('after the admin''s changes only the CURP is left',
    jsonb_array_length(d->'ids') = 1 and d->'ids'->0->>'type_key' = 'mx_curp' and d->'ids'->0->>'last4' = 'RV09');
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.notifications
  where user_id = mate and category::text = 'account' and metadata->>'kind' in ('tax_id_changed', 'tax_id_removed');
  insert into t_results values ('the person hears about the change and the removal (saving the same value again is silent)', n = 2);
  select count(*) into n from public.os_person_tax_ids
  where tenant_id = ten and user_id = mate and type_key = 'mx_rfc' and removed_at is not null and value_enc is null;
  insert into t_results values ('a removed tax ID keeps its row, without the value', n = 1);
  select count(*) into n from public.os_person_tax_ids
  where tenant_id = ten and user_id = mate and type_key = 'mx_curp'
    and position(convert_to('MAHJ', 'UTF8') in value_enc) > 0;
  insert into t_results values ('the value is stored encrypted', n = 0);

  -- 5. Useful links: an admin adds one, a member reads it, a member can't add one.
  perform set_config('role', 'authenticated', true);
  insert into public.os_useful_links (tenant_id, title, description, url, position)
  values (ten, '  Team   handbook ', '  ', 'https://example.com/handbook', 1)
  returning id into link;
  perform set_config('request.jwt.claims', json_build_object('sub', mate, 'role', 'authenticated')::text, true);
  select count(*) into n from public.os_useful_links where id = link and title = 'Team handbook' and description is null;
  insert into t_results values ('a member reads the link, tidied', n = 1);
  begin
    insert into public.os_useful_links (tenant_id, title, url) values (ten, 'Mine', 'https://example.com');
    insert into t_results values ('a member can''t add a link', false);
  exception when insufficient_privilege then
    insert into t_results values ('a member can''t add a link', true);
  end;
  update public.os_useful_links set title = 'Hacked' where id = link;
  get diagnostics n = row_count;
  insert into t_results values ('a member can''t edit a link', n = 0);
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  begin
    insert into public.os_useful_links (tenant_id, title, url) values (ten, 'Bad', 'javascript:alert(1)');
    insert into t_results values ('only web addresses are links', false);
  exception when check_violation then
    insert into t_results values ('only web addresses are links', true);
  end;
  update public.os_useful_links set archived_at = now() where id = link;
  perform set_config('request.jwt.claims', json_build_object('sub', mate, 'role', 'authenticated')::text, true);
  select count(*) into n from public.os_useful_links where id = link;
  insert into t_results values ('an archived link is hidden from members', n = 0);
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.os_audit_log
  where tenant_id = ten and action in ('link.added', 'link.archived') and detail->>'url' = 'https://example.com/handbook';
  insert into t_results values ('adding and archiving are in the history', n = 2);
end $$;

do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n') into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
