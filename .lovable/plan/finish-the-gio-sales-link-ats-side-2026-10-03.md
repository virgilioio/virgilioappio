# Finish the Gio Sales link (ATS side)

No changes to existing link code. Only setup and checks.

## Steps
1. **Secrets**: check that `GIO_LINK_SECRET` exists. If it is missing, stop and report it. `GIO_SALES_URL` already exists, so I'll open the secure update form for it with the value `https://wfpxtjivdcivayghvilw.supabase.co`. Its current value can't be read back.
2. **Deploy**: redeploy `deliver-integration-outbox` without changing its code. It's already deployed; redeploying makes sure it picks up the new URL.
3. **Scheduling**: check `cron.job` first. A delivery job (`deliver-integration-outbox-retry`) already exists. New events are also sent the moment they are created, so retries every 5 minutes are already covered.
   - Recommendation: keep the existing setup instead of adding a second job that runs every minute (1,440 runs a day, even when there's nothing to send). The every-minute job only adds faster retries, and retries already wait at least 1 minute.
   - If you still want it, I'll change the existing job to run every minute instead of adding a duplicate.
4. **Verify**: count the outbox rows that haven't been delivered yet and list their `last_error` values. "HTTP 404" errors are expected until Gio Sales deploys `ats-opening-event`. I'll also check that `next_attempt_at` keeps moving forward. Once their receiver exists, I'll send one signed test event and confirm `delivered_at` is set.

## Report
Which secrets were set, the deploy result, the cron job name and schedule, and the outbox counts and errors.
