-- Run after 20261026212737_os_commission_delivery inside a transaction that is rolled back.
-- os-sync records Gio Sales' answers for roles and rules; recording never sends
-- a role again or writes the history, and an edit made mid-send still goes out.
-- Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  sdr public.os_commission_roles%rowtype;
  po public.os_commission_roles%rowtype;
  rule_id uuid;
  audits int;
  st text;
begin
  select * into sdr from public.os_commission_roles where tenant_id = ten and key = 'sdr';
  select * into po from public.os_commission_roles where tenant_id = ten and key = 'partner_originator';
  select id into rule_id from public.os_commission_rules where role_id = sdr.id order by effective_from limit 1;
  select count(*) into audits from public.os_audit_log where tenant_id = ten and action like 'commission.%';

  insert into t_results values ('every role and rule starts waiting for Gio Sales',
    not exists (select 1 from public.os_commission_roles where tenant_id = ten and sync_status <> 'pending')
    and not exists (select 1 from public.os_commission_rules where tenant_id = ten and sync_status <> 'pending'));

  -- 1. Gio Sales takes a role.
  perform public.os_commission_role_record(sdr.id, sdr.updated_at, true, null, false);
  insert into t_results values ('a role Gio Sales took is done, unchanged otherwise',
    (select sync_status = 'done' and synced_at is not null and sync_attempts = 1 and updated_at = sdr.updated_at
       from public.os_commission_roles where id = sdr.id));
  insert into t_results values ('recording an answer writes no history',
    (select count(*) from public.os_audit_log where tenant_id = ten and action like 'commission.%') = audits);

  -- 2. An admin renames a role while it is on its way: the old answer doesn't settle it.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update public.os_commission_roles set label = 'Partner Originator (12m)' where id = po.id;
  perform set_config('role', 'postgres', true);
  perform public.os_commission_role_record(po.id, po.updated_at, true, null, false);
  insert into t_results values ('an edit made mid-send stays waiting',
    (select sync_status = 'pending' and sync_attempts = 0 from public.os_commission_roles where id = po.id));
  insert into t_results values ('the edit itself is in the history',
    exists (select 1 from public.os_audit_log where tenant_id = ten and action = 'commission.role_changed'
            and detail->>'label' = 'Partner Originator (12m)'));
  select * into po from public.os_commission_roles where id = po.id;
  perform public.os_commission_role_record(po.id, po.updated_at, true, null, false);
  insert into t_results values ('the edit settles once it is sent',
    (select sync_status = 'done' from public.os_commission_roles where id = po.id));

  -- 3. Saving a role without changing it doesn't send it again.
  perform set_config('role', 'authenticated', true);
  update public.os_commission_roles set label = ' SDR ' where id = sdr.id;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('saving a role unchanged keeps it done',
    (select sync_status = 'done' from public.os_commission_roles where id = sdr.id));

  -- 4. Rules: refused keeps the reason, a retry stays waiting, then done.
  perform public.os_commission_rule_record(rule_id, false, 'Gio Sales holds this rule version with other terms.', false);
  insert into t_results values ('a refused rule keeps Gio Sales'' reason',
    (select sync_status = 'refused' and sync_error like 'Gio Sales holds%' from public.os_commission_rules where id = rule_id));
  perform public.os_commission_rule_record(rule_id, false, 'HTTP 503', true);
  insert into t_results values ('a retry waits again',
    (select sync_status = 'pending' and sync_attempts = 2 from public.os_commission_rules where id = rule_id));
  perform public.os_commission_rule_record(rule_id, true, null, false);
  insert into t_results values ('a delivered rule is done',
    (select sync_status = 'done' and sync_error is null and synced_at is not null from public.os_commission_rules where id = rule_id));

  -- 5. Only os-sync records answers.
  perform set_config('role', 'authenticated', true);
  begin
    perform public.os_commission_rule_record(rule_id, true, null, false);
    st := 'ran';
  exception when others then st := sqlstate; end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('signed-in people can''t record answers', st = '42501');
  perform set_config('role', 'authenticated', true);
  begin
    update public.os_commission_roles set sync_status = 'done' where id = po.id;
    st := 'ran';
  exception when others then st := sqlstate; end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('nor write delivery fields', st = '42501');
end $$;
