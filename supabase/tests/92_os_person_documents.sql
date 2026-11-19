-- Files on a person's profile: admins upload, rename, remove and restore; the
-- person sees their own; nobody else; history and the bell. Runs inside a block
-- that ends by raising its result, so nothing it writes is kept.
do $t$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  adm uuid; person uuid; other uuid; ext uuid;
  doc uuid; n int; ok boolean;
  r text := '';
  rec record;
  as_user constant text := 'authenticated';
begin
  select m.user_id into adm from public.members m join public.profiles p on p.user_id = m.user_id
  where m.tenant_id = ten and lower(p.email) = 'allan@virgilio.tech' and m.user_status = 'active' limit 1;
  select m.user_id into person from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role = 'member' and m.user_type = 'member' and m.user_id <> adm
  order by m.user_id limit 1;
  select m.user_id into other from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role = 'member' and m.user_type = 'member' and m.user_id not in (adm, person)
  order by m.user_id limit 1;
  select m.user_id into ext from public.members m where m.tenant_id = ten and m.user_type = 'external' limit 1;
  r := 'setup=' || (adm is not null and person is not null and other is not null and ext is not null);

  -- An admin adds an agreement for the person.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.os_person_documents (tenant_id, user_id, name, kind, signed_on, file_name, storage_path, mime_type, size_bytes)
  values (ten, person, '  Contractor agreement 2025  ', 'agreement', date '2025-03-01', 'contract.pdf',
          ten::text || '/' || person::text || '/test-contract.pdf', 'application/pdf', 1000)
  returning id into doc;
  reset role;
  select * into rec from public.os_person_documents where id = doc;
  r := r || ' admin_adds=' || (rec.name = 'Contractor agreement 2025' and rec.uploaded_by = adm and rec.removed_at is null);
  select count(*) into n from public.os_audit_log where subject_user_id = person and action = 'person.document_added' and detail->>'name' = 'Contractor agreement 2025';
  r := r || ' history_added=' || (n = 1);
  select count(*) into n from public.notifications where user_id = person and entity_id = doc
    and title = 'A new agreement was added to your profile' and action_url = '/me?tab=agreements' and category = 'account';
  r := r || ' bell_rings=' || (n = 1);

  -- The person sees it; another member doesn't.
  perform set_config('request.jwt.claims', json_build_object('sub', person, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.os_person_documents where id = doc;
  r := r || ' person_sees_own=' || (n = 1);
  r := r || ' person_can_open_file=' || public.os_person_document_can_read(ten::text || '/' || person::text || '/test-contract.pdf');
  -- The person can't add, change or remove.
  begin
    insert into public.os_person_documents (tenant_id, user_id, name, file_name, storage_path)
    values (ten, person, 'Mine', 'mine.pdf', ten::text || '/' || person::text || '/mine.pdf');
    r := r || ' person_cant_add=false';
  exception when others then
    r := r || ' person_cant_add=' || (sqlstate = '42501');
  end;
  update public.os_person_documents set name = 'Renamed by me' where id = doc;
  get diagnostics n = row_count;
  r := r || ' person_cant_rename=' || (n = 0);
  update public.os_person_documents set removed_at = now() where id = doc;
  get diagnostics n = row_count;
  r := r || ' person_cant_remove=' || (n = 0);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.os_person_documents where id = doc;
  r := r || ' teammate_sees_nothing=' || (n = 0);
  r := r || ' teammate_cant_open_file=' || (not public.os_person_document_can_read(ten::text || '/' || person::text || '/test-contract.pdf'));
  reset role;

  -- Admin renames, removes, restores.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.os_person_documents set name = 'Contractor agreement', kind = 'amendment' where id = doc;
  update public.os_person_documents set removed_at = now() where id = doc;
  reset role;
  select * into rec from public.os_person_documents where id = doc;
  r := r || ' removed_kept=' || (rec.removed_at is not null and rec.removed_by = adm);
  select count(*) into n from public.os_audit_log where subject_user_id = person and action = 'person.document_updated'
    and detail->'fields' ? 'name' and detail->'fields' ? 'kind';
  r := r || ' history_updated=' || (n = 1);
  select count(*) into n from public.os_audit_log where subject_user_id = person and action = 'person.document_removed';
  r := r || ' history_removed=' || (n = 1);

  perform set_config('request.jwt.claims', json_build_object('sub', person, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.os_person_documents where id = doc;
  r := r || ' removed_hidden_from_person=' || (n = 0);
  r := r || ' removed_file_closed=' || (not public.os_person_document_can_read(ten::text || '/' || person::text || '/test-contract.pdf'));
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.os_person_documents where id = doc;
  r := r || ' admin_still_sees_removed=' || (n = 1);
  update public.os_person_documents set removed_at = null where id = doc;
  reset role;
  select * into rec from public.os_person_documents where id = doc;
  select count(*) into n from public.os_audit_log where subject_user_id = person and action = 'person.document_restored';
  r := r || ' undo_restores=' || (rec.removed_at is null and rec.removed_by is null and n = 1);

  -- The rules the database keeps.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.os_person_documents set user_id = other where id = doc;
    r := r || ' cant_move_to_another_person=false';
  exception when others then
    r := r || ' cant_move_to_another_person=' || (sqlstate = '42501');
  end;
  begin
    insert into public.os_person_documents (tenant_id, user_id, name, file_name, storage_path)
    values (ten, person, 'Wrong folder', 'x.pdf', ten::text || '/' || other::text || '/x.pdf');
    r := r || ' wrong_folder_refused=false';
  exception when others then
    r := r || ' wrong_folder_refused=' || (sqlstate = 'GDC01');
  end;
  begin
    insert into public.os_person_documents (tenant_id, user_id, name, file_name, storage_path, signed_on)
    values (ten, person, 'Future', 'f.pdf', ten::text || '/' || person::text || '/f.pdf', current_date + 30);
    r := r || ' future_date_refused=false';
  exception when others then
    r := r || ' future_date_refused=' || (sqlstate = 'GDC02');
  end;
  begin
    insert into public.os_person_documents (tenant_id, user_id, name, file_name, storage_path)
    values (ten, ext, 'External', 'e.pdf', ten::text || '/' || ext::text || '/e.pdf');
    r := r || ' external_refused=false';
  exception when others then
    r := r || ' external_refused=' || (sqlstate = 'GEX02');
  end;
  reset role;

  -- An admin adding a file to their own profile gets no bell from themself.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.os_person_documents (tenant_id, user_id, name, kind, file_name, storage_path)
  values (ten, adm, 'NDA', 'nda', 'nda.pdf', ten::text || '/' || adm::text || '/nda.pdf') returning id into doc;
  reset role;
  select count(*) into n from public.notifications where entity_id = doc;
  r := r || ' no_bell_for_yourself=' || (n = 0);

  r := r || ' path_reads_workspace=' || (public.os_person_document_tenant(ten::text || '/' || person::text || '/a.pdf') = ten
                                         and public.os_person_document_tenant('elsewhere/a.pdf') is null);
  r := r || ' anon_reads_nothing=' || (not has_table_privilege('anon', 'public.os_person_documents', 'select'));

  raise exception 'RESULT %', r;
end $t$;
