-- Run after 20261023100000_os_sync_cron_rates inside a transaction that is rolled back.
-- The os-sync cron still fires for pending queue items and now also for
-- commission rates waiting to reach Gio Sales. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

insert into t_results select 'one os-sync job', count(*) = 1 from cron.job where jobname = 'os-sync';
insert into t_results select 'every 5 minutes', bool_and(schedule = '*/5 * * * *') from cron.job where jobname = 'os-sync';
insert into t_results select 'still fires for the queue', bool_and(position('os_sync_queue' in command) > 0) from cron.job where jobname = 'os-sync';
insert into t_results select 'fires for waiting rates', bool_and(position('os_commission_rates' in command) > 0) from cron.job where jobname = 'os-sync';
insert into t_results select 'job is active', bool_and(active) from cron.job where jobname = 'os-sync';

select * from t_results;
