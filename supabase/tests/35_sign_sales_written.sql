-- Run after 20261019154719_sign_sales_written inside a transaction that is rolled back.
-- The Gio Sales template made of one written document is sent to a fake client:
-- the envelope gets its written copy, waits for its PDF, and a deal without the
-- contact's email is refused. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

do $$
declare
  tpl uuid := (select id from public.sign_templates where app = 'sales' and kind = 'customer' and archived_at is null
                 and exists (select 1 from public.sign_written_docs w where w.template_id = sign_templates.id and w.removed_at is null)
               order by updated_at desc limit 1);
  role uuid := (select id from public.sign_recipients where template_id = tpl and envelope_id is null and removed_at is null
                  and not fixed and role <> 'cc' order by position limit 1);
  org constant uuid := '00000000-0000-4000-8000-0000000000aa';
  deal constant uuid := '00000000-0000-4000-8000-0000000000bb';
  env uuid; ok boolean; msg text;
begin
  insert into t_results values ('a Gio Sales template with a written document exists', tpl is not null and role is not null);

  env := public.sign_send_sales(tpl, org, deal, null, 'TEST Acme · Expansion', gen_random_uuid(), 'TEST Sender', 'test.sender@example.com',
    jsonb_build_object('company', 'TEST Acme', 'contact', 'TEST Priya Raman', 'contact_email', 'test.priya@example.com', 'deal', 'Expansion'),
    jsonb_build_array(jsonb_build_object('role_id', role, 'name', 'TEST Priya Raman', 'email', 'test.priya@example.com')),
    now() + interval '2 days');

  insert into t_results values ('the envelope carries every written document of the template',
    (select count(*) from public.sign_written_docs where envelope_id = env and removed_at is null)
    = (select count(*) from public.sign_written_docs where template_id = tpl and removed_at is null));
  insert into t_results values ('the written copy waits for its PDF',
    not exists (select 1 from public.sign_written_docs where envelope_id = env and rendered_document_id is not null));
  insert into t_results values ('the frozen values hold the deal''s contact',
    (select data_snapshot->>'contact' = 'TEST Priya Raman' and data_snapshot ? 'today' and data_snapshot->>'sender' = 'TEST Sender'
       from public.sign_envelopes where id = env));
  insert into t_results values ('the envelope waits as scheduled',
    not exists (select 1 from public.sign_envelopes where id = env and status not in ('scheduled')));

  ok := false;
  begin
    perform public.sign_send_sales(tpl, org, deal, null, 'TEST', gen_random_uuid(), 'TEST Sender', 'test.sender@example.com',
      jsonb_build_object('company', 'TEST Acme', 'contact', 'TEST Priya Raman'),
      jsonb_build_array(jsonb_build_object('role_id', role, 'name', 'TEST Priya Raman', 'email', 'test.priya@example.com')), null);
  exception when sqlstate 'GSN14' then
    get stacked diagnostics msg = message_text;
    ok := msg like '%Contact email%';
  end;
  insert into t_results values ('a written tag missing from the deal stops the send (GSN14, names it)', ok);
end $$;
