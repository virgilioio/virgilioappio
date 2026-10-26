-- Run after 20261026200000_os_commission_roles inside a transaction that is rolled back.
-- Allan (an admin) adds a role, gives it rules, changes a built-in rate and is
-- refused what the rules don't allow; a member reads but can't change anything.
-- Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  member uuid;
  closer uuid;
  sdr uuid;
  sales_new uuid;
  series uuid;
  st text;
  n int;
  later date := current_date + 30;
begin
  select m.user_id into member from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin'
    and m.user_id <> allan and coalesce(m.user_type::text, '') <> 'external'
  order by m.created_at limit 1;
  select id into sdr from public.os_commission_roles where tenant_id = ten and key = 'sdr';
  select id into sales_new from public.os_commission_roles where tenant_id = ten and key = 'sales_new';
  -- The rules in force are read as someone in the workspace.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);

  -- 1. What the migration starts with.
  insert into t_results values ('seven roles, five built in',
    (select count(*) = 7 and count(*) filter (where built_in) = 5 from public.os_commission_roles where tenant_id = ten));
  insert into t_results values ('built-in rules hold today''s rates',
    (select bool_and(r.pct = x.pct) and count(*) = 5
       from public.os_commission_rules_in_force(ten) r
       join public.os_commission_roles ro on ro.id = r.role_id and ro.built_in
       join public.os_commission_rates x on x.tenant_id = ten and x.role_key = ro.key));
  insert into t_results values ('Sourcer and Recruiter are on success fees, Sales new on new clients',
    (select bool_and(case ro.key when 'sp' then r.fees = array['success'] when 'tap' then r.fees = array['success']
                                 when 'sales_new' then r.client = 'new' and not ('engagement' = any (r.fees)) else true end)
       from public.os_commission_rules_in_force(ten) r join public.os_commission_roles ro on ro.id = r.role_id));
  insert into t_results values ('SDR: USD 100 when a partner accepts the lead',
    (select r.basis = 'fixed' and r.amount = 100 and r.currency = 'USD' and r.payable_on = 'lead_accepted'
            and r.applies_to = 'partner_items' and r.partner_items = 'fixed'
       from public.os_commission_rules_in_force(ten) r where r.role_id = sdr));
  insert into t_results values ('Partner Originator: 10% of recurring partner items for 12 months',
    (select r.basis = 'percent' and r.pct = 10 and r.payable_on = 'payment' and r.partner_items = 'recurring' and r.months = 12
       from public.os_commission_rules_in_force(ten) r
       join public.os_commission_roles ro on ro.id = r.role_id and ro.key = 'partner_originator'));

  -- 2. A member reads roles and rules but changes nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.os_commission_roles;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('a member reads the roles', n = 7);
  perform set_config('role', 'authenticated', true);
  begin
    insert into public.os_commission_roles (tenant_id, label, person_source) values (ten, 'Sneaky', 'deal_sales');
    st := 'added';
  exception when others then st := sqlstate; end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('a member can''t add a role', st = '42501');

  -- 3. Allan adds a role and gives it rules.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.os_commission_roles (tenant_id, label, person_source) values (ten, 'Closer', 'deal_sales')
  returning id into closer;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('a new role gets its key from the label and is not built in',
    (select key = 'closer' and not built_in and sync_status = 'pending' and created_by = allan
       from public.os_commission_roles where id = closer));
  insert into t_results values ('adding a role is in the history',
    exists (select 1 from public.os_audit_log where tenant_id = ten and action = 'commission.role_added' and detail->>'key' = 'closer'));

  perform set_config('role', 'authenticated', true);
  begin
    insert into public.os_commission_roles (tenant_id, label, person_source) values (ten, ' closer ', 'deal_es');
    st := 'added';
  exception when others then st := sqlstate; end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('two roles can''t share a name', st = '23505');

  perform set_config('role', 'authenticated', true);
  begin
    update public.os_commission_roles set person_source = 'deal_es' where id = closer;
    st := 'changed';
  exception when others then st := sqlstate; end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('where a role''s person comes from can''t change', st = '42501');

  perform set_config('role', 'authenticated', true);
  begin
    update public.os_commission_roles set active = false where id = sales_new;
    st := 'off';
  exception when others then st := sqlstate; end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('a built-in role stays on', st = 'GCR02');

  perform set_config('role', 'authenticated', true);
  begin
    insert into public.os_commission_rules (tenant_id, role_id, effective_from, basis, applies_to)
    values (ten, closer, current_date, 'fixed', 'services');
    st := 'added';
  exception when others then st := sqlstate; end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('a fixed amount needs its amount and currency', st = 'GCR05');

  perform set_config('role', 'authenticated', true);
  begin
    insert into public.os_commission_rules (tenant_id, role_id, effective_from, basis, pct, payable_on, applies_to)
    values (ten, closer, current_date, 'percent', 5, 'lead_accepted', 'partner_items');
    st := 'added';
  exception when others then st := sqlstate; end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('only a fixed amount is paid on an accepted lead', st = 'GCR06');

  perform set_config('role', 'authenticated', true);
  insert into public.os_commission_rules (tenant_id, role_id, effective_from, basis, amount, currency, applies_to, fees, client)
  values (ten, closer, current_date, 'fixed', 50, 'usd', 'services', array['consulting'], 'new')
  returning series_id into series;
  insert into public.os_commission_rules (tenant_id, role_id, series_id, effective_from, stopped, basis, applies_to)
  values (ten, closer, series, current_date + 2, true, 'fixed', 'services');
  perform set_config('role', 'postgres', true);
  insert into t_results values ('a rule starts a series, upper-cases its currency and is in the history',
    (select currency = 'USD' and amount = 50 and fees = array['consulting'] from public.os_commission_rules
      where series_id = series and not stopped)
    and exists (select 1 from public.os_audit_log where tenant_id = ten and action = 'commission.rule_added' and detail->>'series_id' = series::text));
  insert into t_results values ('a stopped rule applies until its stop date, then not',
    exists (select 1 from public.os_commission_rules_in_force(ten, current_date + 1) r where r.series_id = series)
    and not exists (select 1 from public.os_commission_rules_in_force(ten, current_date + 3) r where r.series_id = series));
  insert into t_results values ('a stopped version keeps the rule''s terms',
    (select amount = 50 and fees = array['consulting'] and client = 'new' from public.os_commission_rules
      where series_id = series and stopped));

  perform set_config('role', 'authenticated', true);
  begin
    insert into public.os_commission_rules (tenant_id, role_id, series_id, effective_from, basis, amount, currency, applies_to)
    values (ten, sdr, series, current_date + 5, 'fixed', 10, 'USD', 'services');
    st := 'added';
  exception when others then st := sqlstate; end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('a rule stays with its role', st = 'GCR04');

  perform set_config('role', 'authenticated', true);
  begin
    insert into public.os_commission_rules (tenant_id, role_id, effective_from, stopped, basis, applies_to)
    values (ten, closer, current_date, true, 'fixed', 'services');
    st := 'added';
  exception when others then st := sqlstate; end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('only an existing rule can be stopped', st = 'GCR07');

  perform set_config('role', 'authenticated', true);
  begin
    update public.os_commission_rules set amount = 75 where series_id = series;
    st := 'changed';
  exception when others then st := sqlstate; end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('rules are never edited, only versioned', st = '42501');

  -- 4. A built-in role's rate changes as a new version, also delivered as a rate.
  perform set_config('role', 'authenticated', true);
  insert into public.os_commission_rules (tenant_id, role_id, series_id, effective_from, basis, pct, applies_to, client)
  values (ten, sales_new, sales_new, later, 'percent', 12, 'partner_items', 'any');
  perform set_config('role', 'postgres', true);
  insert into t_results values ('a built-in rate change keeps its terms',
    (select pct = 12 and applies_to = 'services' and client = 'new' and fees = array['success', 'ta-other', 'consulting', 'c-other']
       from public.os_commission_rules where series_id = sales_new and effective_from = later));
  insert into t_results values ('a built-in rate change is waiting to go to Gio Sales as a rate',
    exists (select 1 from public.os_commission_rates where tenant_id = ten and role_key = 'sales_new'
            and effective_from = later and pct = 12 and sync_status = 'pending'));
  insert into t_results values ('today''s Sales rate is unchanged until then',
    (select pct = 10 from public.os_commission_rules_in_force(ten) r where r.series_id = sales_new));

  perform set_config('role', 'authenticated', true);
  begin
    insert into public.os_commission_rules (tenant_id, role_id, effective_from, basis, pct, applies_to)
    values (ten, sales_new, current_date, 'percent', 3, 'services');
    st := 'added';
  exception when others then st := sqlstate; end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('a built-in role keeps one rule for now', st = 'GCR08');

  perform set_config('role', 'authenticated', true);
  begin
    insert into public.os_commission_rules (tenant_id, role_id, series_id, effective_from, basis, pct, applies_to)
    values (ten, sales_new, sales_new, later, 'percent', 11, 'services');
    st := 'added';
  exception when others then st := sqlstate; end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('one version per rule per day', st = '23505');

  perform set_config('role', 'authenticated', true);
  begin
    insert into public.os_commission_rates (tenant_id, role_key, pct, effective_from) values (ten, 'es', 6, later);
    st := 'added';
  exception when others then st := sqlstate; end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('rates are no longer added directly', st = '42501');
end $$;
