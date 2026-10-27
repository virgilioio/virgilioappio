-- Run after the os_sync_wakes_for_commissions migration inside a transaction that is rolled back.
-- The os-sync job now wakes for waiting commission roles and rules, and still
-- for access changes and rates, with the same secret lookup. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

insert into t_results
select 'the job wakes for waiting roles and rules',
       command like '%public.os_commission_roles where sync_status = ''pending''%'
   and command like '%public.os_commission_rules where sync_status = ''pending''%'
from cron.job where jobname = 'os-sync';

insert into t_results
select 'and still for access changes and rates',
       command like '%public.os_sync_queue where status = ''pending''%'
   and command like '%public.os_commission_rates where sync_status = ''pending''%'
from cron.job where jobname = 'os-sync';

insert into t_results
select 'with the same secret lookup and schedule',
       command like '%vault.decrypted_secrets%' and schedule = '*/5 * * * *' and active
from cron.job where jobname = 'os-sync';
