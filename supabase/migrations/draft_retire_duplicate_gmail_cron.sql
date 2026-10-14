-- Two schedules ran the Gmail sync every 15 minutes. The older one,
-- "sync-all-gmail-accounts", still calls with the public key and has been
-- turned away (404) on every run since the function started requiring the
-- internal secret. "sync-all-gmail-accounts-v2" does the real work and stays.
select cron.unschedule('sync-all-gmail-accounts');
