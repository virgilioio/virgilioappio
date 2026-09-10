# Fix: stage automations never run

## What I found (confirmed)

The automation itself is fine. When you moved the candidate into the stage, the system correctly queued the work: there is a queued run created at 22:25 today for your "Send an email" automation on that stage, and it is still sitting in `scheduled` state over an hour later.

The part that actually sends is a background worker that is called once a minute. Every one of those calls is being rejected. The call log shows a `404 {"error":"not_found"}` reply every minute, which is the worker's way of saying "I don't recognise this caller". The shared password the scheduler sends no longer matches the one stored for the worker, so the worker refuses the request before doing anything — silently, with no error trail.

Two other scheduled jobs are failing the same way for the same reason: the scheduled-email sender and the Gmail sync worker. That is why nothing was written to the Activity feed either — the email was never sent, so there was no event to log.

## The fix

1. Set a fresh shared password for internal background calls and store it for the worker.
2. Update the three scheduler entries (automation worker, scheduled emails, Gmail sync) to send that same password, so every minute-by-minute call is accepted again.
3. Verify: watch the next scheduled run turn from queued into sent, confirm the email goes out, and confirm the run shows up both in the automation's run history and in the candidate's Activity tab.
4. Make future failures visible instead of silent: the worker will log a rejected call (without revealing the password), matching what the other workers already do.

## Decision needed

Your queued run is over an hour old. Once the worker starts up it will pick it up and send that email to the candidate immediately. Tell me if you'd rather cancel that stale run instead, and I'll cancel it before switching the worker back on.

## Technical details

- Confirmed: `stage_automation_runs` has one row, `status = scheduled`, `scheduled_for = 2026-09-10 22:25`, `executed_at = null`, for automation `ea4d4580` (trigger `enter`, action `email`, active) on stage `8e7fa305`. The DB trigger enqueued correctly.
- `cron.job_run_details` shows jobid 1 succeeding every minute (the HTTP post is issued), but `net._http_response` returns `404 {"error":"not_found"}` for it each time. That is the early return in `process-automation-emails/index.ts` when neither `x-internal-secret === INTERNAL_FUNCTION_SECRET` nor `Authorization` containing the service-role key matches. Function logs show boot/shutdown with no handler output, consistent with that branch.
- Cron jobs 1, 6, 19 send a hardcoded `x-internal-secret` literal plus a hardcoded bearer; jobs 6 and 19 log `[auth-gate] Unauthorized call. enforce=true`. Same root cause.
- Actions: generate a new value, `secrets--update_secret` for `INTERNAL_FUNCTION_SECRET`, then a migration using `cron.alter_job`/`cron.schedule` to rewrite the commands of jobs 1, 6 and 19 with the matching header. Job 5 (`renew-calendar-webhooks-daily`) uses `current_setting('app.settings.service_role_key')` for auth — review and align it in the same pass.
- Add a `console.warn('[auth-gate] Unauthorized call')` before the 404 return in `process-automation-emails`, then redeploy. No frontend or schema change.
