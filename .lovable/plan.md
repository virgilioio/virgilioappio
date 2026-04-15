

# Wire Up the Scheduled Email Cron Job

## Problem
The `send-scheduled-emails` edge function works fine but is never invoked. There is no `pg_cron` job calling it, so scheduled emails (e.g. delayed rejection emails) are inserted into `scheduled_emails` with status `pending` and never processed.

## Fix

Use the Supabase SQL editor (not a migration — it contains project-specific URL and anon key) to create a pg_cron job that calls `send-scheduled-emails` every minute:

```sql
SELECT cron.schedule(
  'send-scheduled-emails',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-scheduled-emails',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

Also ensure `pg_cron` and `pg_net` extensions are enabled (they likely already are from the email queue setup).

## What this means
- Every minute, the cron job hits `send-scheduled-emails`
- The function picks up any `pending` emails whose `scheduled_for` timestamp has passed
- Processes up to 50 per batch, marks them `sent` or `failed`
- Rejection emails finally get delivered on time

## Scope
- 1 SQL insert via Supabase tools (not a migration file)
- No code changes needed — the edge function is already correct

