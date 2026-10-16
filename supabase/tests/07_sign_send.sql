-- Gio Sign: saving templates and sending from a record (build step 6).
-- Runs against a real database inside one transaction and always ends with
-- raise exception 'RESULT ...', so nothing it creates is kept.
--
-- Users from live data: the admin (Allan), a non-admin member assigned to a
-- job that has a candidate (the "TA"), and a non-admin member not on that job.

do $t$
declare
  ten uuid; adm uuid; ta uuid; oth uuid; job uuid; cand uuid; mem uuid;
  tpl uuid := gen_random_uuid(); mtpl uuid := gen_random_uuid();
  d1 uuid := gen_random_uuid(); r1 uuid := gen_random_uuid(); r2 uuid := gen_random_uuid();
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid(); f3 uuid := gen_random_uuid(); f4 uuid := gen_random_uuid();
  md uuid := gen_random_uuid(); mr uuid := gen_random_uuid(); mf uuid := gen_random_uuid();
  body jsonb; mbody jsonb; prev jsonb; env uuid; env2 uuid;
  stamp timestamptz; n int; s text; ok boolean;
  r text := '';
begin
  select m.user_id, m.tenant_id into adm, ten
  from public.members m join public.profiles p on p.user_id = m.user_id
  where lower(p.email) = 'allan@virgilio.tech' and m.user_status = 'active' limit 1;

  select ja.user_id, ja.job_id, a.candidate_id into ta, job, cand
  from public.job_assignments ja
  join public.members m on m.user_id = ja.user_id and m.tenant_id = ten
    and m.user_status = 'active' and m.system_role <> 'admin' and m.user_type <> 'platform_admin'
  join public.job_candidate_associations a on a.job_id = ja.job_id
  join public.candidates c on c.id = a.candidate_id and c.deleted_at is null and coalesce(c.email, c.contact_email) is not null
  join public.jobs j on j.id = ja.job_id and j.tenant_id = ten and j.deleted_at is null
  where ja.deleted_at is null limit 1;

  select m.user_id into oth
  from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role <> 'admin'
    and m.user_type <> 'platform_admin' and m.user_id <> ta
    and not exists (select 1 from public.job_assignments ja where ja.user_id = m.user_id and ja.job_id = job and ja.deleted_at is null)
  limit 1;

  select m.id into mem from public.members m where m.tenant_id = ten and m.user_id = oth;

  r := 'users=' || (adm is not null and ta is not null and oth is not null and cand is not null);

  body := jsonb_build_object(
    'id', tpl, 'tenant_id', ten, 'name', 'TEST offer', 'description', '', 'kind', 'candidate', 'app', 'ats',
    'ordered', true, 'subject', 'Your offer for {{job}}', 'body', 'Hi {{name}}', 'reminder_days', 2, 'expiry_days', 14,
    'docs', jsonb_build_array(jsonb_build_object('id', d1, 'name', 'a.pdf', 'storage_path', ten || '/templates/' || tpl || '/a.pdf',
      'page_count', 2, 'page_sizes', '[{"w":612,"h":792},{"w":612,"h":792}]'::jsonb, 'size_bytes', 2809, 'sha256', null)),
    'roles', jsonb_build_array(
      jsonb_build_object('id', r1, 'label', 'Candidate', 'role', 'signer', 'fixed', false, 'name', '', 'email', '', 'color', '#D7C5FB'),
      jsonb_build_object('id', r2, 'label', 'Countersigner', 'role', 'signer', 'fixed', true, 'name', 'Allan Bravo', 'email', 'Allan@virgilio.tech', 'color', '#BFE3CF')),
    'fields', jsonb_build_array(
      jsonb_build_object('id', f1, 'type', 'signature', 'rid', r1, 'page', 1, 'x', 12, 'y', 75.6654, 'w', 30, 'h', 6.2, 'required', true, 'data_key', null),
      jsonb_build_object('id', f2, 'type', 'signature', 'rid', r2, 'page', 1, 'x', 56, 'y', 75, 'w', 30, 'h', 6.2, 'required', true, 'data_key', null),
      jsonb_build_object('id', f3, 'type', 'data', 'rid', null, 'page', 0, 'x', 12, 'y', 20, 'w', 26, 'h', 3.6, 'required', true, 'data_key', 'name'),
      jsonb_build_object('id', f4, 'type', 'data', 'rid', null, 'page', 0, 'x', 12, 'y', 26, 'w', 26, 'h', 3.6, 'required', true, 'data_key', 'job')));

  mbody := jsonb_build_object(
    'id', mtpl, 'tenant_id', ten, 'name', 'TEST member', 'kind', 'member', 'app', 'ats', 'subject', 'S', 'body', 'B',
    'docs', jsonb_build_array(jsonb_build_object('id', md, 'name', 'm.pdf', 'storage_path', ten || '/templates/' || mtpl || '/m.pdf', 'page_count', 1, 'size_bytes', 100)),
    'roles', jsonb_build_array(jsonb_build_object('id', mr, 'label', 'Member', 'role', 'signer', 'fixed', false, 'color', '#D7C5FB')),
    'fields', jsonb_build_array(jsonb_build_object('id', mf, 'type', 'signature', 'rid', mr, 'page', 0, 'x', 10, 'y', 80, 'w', 30, 'h', 6)));

  -- ---------- admin saves ----------
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'allan@virgilio.tech')::text, true);
  set local role authenticated;
  perform public.sign_save_template(body);                                   -- new template
  perform public.sign_save_template(mbody);
  select count(*) into n from public.sign_fields where template_id = tpl and removed_at is null;
  r := r || ' adm_save_new=' || n;                                           -- 4
  select email into s from public.sign_recipients where id = r2;
  r := r || ' fixed_email=' || s;                                            -- allan@virgilio.tech
  -- second save: field f4 dropped, f1 moved
  body := jsonb_set(body, '{fields}', (body->'fields') - 3);
  body := jsonb_set(body, '{fields,0,x}', '14');
  perform public.sign_save_template(body);
  select count(*) into n from public.sign_fields where template_id = tpl and removed_at is null;
  r := r || ' adm_resave=' || n;                                             -- 3
  select x::text into s from public.sign_fields where id = f1;
  r := r || ' moved_x=' || s;                                                -- 14.000
  begin
    perform public.sign_save_template(jsonb_set(body, '{fields}', '[]'));
    r := r || ' no_sig=saved';
  exception when sqlstate 'GSN12' then r := r || ' no_sig=GSN12'; end;       -- GSN12
  begin
    perform public.sign_save_template(jsonb_set(body, '{docs,0,storage_path}', '"elsewhere/x.pdf"'));
    r := r || ' bad_path=saved';
  exception when sqlstate 'GSN12' then r := r || ' bad_path=GSN12'; end;     -- GSN12
  select updated_at into stamp from public.sign_templates where id = tpl;

  -- ---------- TA ----------
  perform set_config('request.jwt.claims', json_build_object('sub', ta, 'role', 'authenticated')::text, true);
  begin
    perform public.sign_save_template(body);
    r := r || ' ta_save=saved';
  exception when sqlstate '42501' then r := r || ' ta_save=42501'; end;      -- 42501
  prev := public.sign_send_preview(tpl, 'candidate', cand, job);
  r := r || ' ta_preview_roles=' || jsonb_array_length(prev->'roles')        -- 2
          || ' prefilled=' || ((prev->'roles'->0->>'email') <> '')           -- true
          || ' missing=' || jsonb_array_length(prev->'missing');            -- 0
  env := public.sign_send(tpl, 'candidate', cand, job,
    jsonb_build_array(jsonb_build_object('role_id', r1, 'name', prev->'roles'->0->>'name', 'email', prev->'roles'->0->>'email')));
  select status::text || '/' || (dispatch_at > now()) into s from public.sign_envelopes where id = env;
  r := r || ' ta_send=' || s;                                                -- queued/true
  select count(*) into n from public.sign_recipients where envelope_id = env;
  r := r || ' env_people=' || n;                                             -- 2
  select count(*) into n from public.sign_fields where envelope_id = env and type = 'data' and value is not null;
  r := r || ' data_frozen=' || n;                                            -- 1
  select count(*) into n from public.sign_documents where envelope_id = env;
  r := r || ' env_docs=' || n;                                               -- 1
  select uses || '/' || (updated_at = stamp) into s from public.sign_templates where id = tpl;
  r := r || ' uses=' || s;                                                   -- 1/true
  select count(*) into n from public.sign_events where envelope_id = env;
  r := r || ' events=' || n;                                                 -- 2
  ok := public.sign_undo_send(env);
  perform public.sign_set_draft_removed(env, true);
  select status::text || '/' || (deleted_at is not null) into s from public.sign_envelopes where id = env;
  r := r || ' undo=' || ok || '/' || s;                                      -- true/draft/true
  begin
    perform public.sign_send(tpl, 'candidate', cand, job, '[]'::jsonb);
    r := r || ' no_people=sent';
  exception when sqlstate 'GSN13' then r := r || ' no_people=GSN13'; end;    -- GSN13
  begin
    perform public.sign_send(tpl, 'candidate', cand, job,
      jsonb_build_array(jsonb_build_object('role_id', r1, 'name', 'X', 'email', 'allan@virgilio.tech')));
    r := r || ' dup=sent';
  exception when sqlstate 'GSN13' then r := r || ' dup=GSN13'; end;          -- GSN13
  begin
    perform public.sign_send(tpl, 'candidate', cand, job,
      jsonb_build_array(jsonb_build_object('role_id', r1, 'name', 'X', 'email', 'x@example.com')), now());
    r := r || ' past=sent';
  exception when sqlstate 'GSN08' then r := r || ' past=GSN08'; end;         -- GSN08
  begin
    perform public.sign_send(mtpl, 'member', mem, null,
      jsonb_build_array(jsonb_build_object('role_id', mr, 'name', 'X', 'email', 'x@example.com')));
    r := r || ' ta_member=sent';
  exception when sqlstate '42501' then r := r || ' ta_member=42501'; end;    -- 42501

  -- ---------- someone not on the job ----------
  perform set_config('request.jwt.claims', json_build_object('sub', oth, 'role', 'authenticated')::text, true);
  begin
    perform public.sign_send(tpl, 'candidate', cand, job,
      jsonb_build_array(jsonb_build_object('role_id', r1, 'name', 'X', 'email', 'x@example.com')));
    r := r || ' oth_send=sent';
  exception when sqlstate '42501' then r := r || ' oth_send=42501'; end;     -- 42501
  begin
    perform public.sign_send_preview(tpl, 'candidate', cand, job);
    r := r || ' oth_preview=shown';
  exception when sqlstate '42501' then r := r || ' oth_preview=42501'; end;  -- 42501

  -- ---------- admin: member agreement, scheduled ----------
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'allan@virgilio.tech')::text, true);
  prev := public.sign_send_preview(mtpl, 'member', mem, null);
  env2 := public.sign_send(mtpl, 'member', mem, null,
    jsonb_build_array(jsonb_build_object('role_id', mr, 'name', prev->'roles'->0->>'name', 'email', prev->'roles'->0->>'email')),
    now() + interval '1 day');
  select status::text into s from public.sign_envelopes where id = env2;
  r := r || ' adm_member=' || s;                                             -- scheduled
  begin
    perform public.sign_send(tpl, 'member', mem, null, '[]'::jsonb);
    r := r || ' wrong_kind=sent';
  exception when sqlstate 'GSN10' then r := r || ' wrong_kind=GSN10'; end;   -- GSN10

  -- ---------- anon ----------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    perform public.sign_send_preview(tpl, 'candidate', cand, job);
    r := r || ' anon=shown';
  exception when sqlstate '42501' then r := r || ' anon=42501'; end;         -- 42501

  raise exception 'RESULT %', r;
end $t$;
