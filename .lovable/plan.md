# Client name placeholder for templates

Today templates only offer "Company / Workspace Name" (`{{organization.name}}`), which resolves to your own workspace name — and in one-off candidate emails it resolves to nothing at all. There is no way to print the name of the company you are hiring for, even though every job is attached to a client company in the CRM.

This adds a dedicated **Client name** placeholder, `{{client.name}}`, that always prints the CRM company the job belongs to. `{{organization.name}}` keeps its current meaning (your own workspace) so no existing template changes behaviour.

## What you will see

- A new **Client** group in the variables/placeholder picker with one entry: **Client name** — "The company the job is for (from the CRM)".
- `{{client.name}}` works in email templates, rejection templates, automation emails, application-confirmation emails, one-off candidate emails, WhatsApp shortcuts and offer letters.
- When a template is used without a job (no client to resolve), the placeholder prints nothing, exactly like other unresolved placeholders do today.
- The existing entry is relabelled **Your workspace name** so the two are no longer confusable.

## Technical scope

Resolution rule: `jobs.organization_id -> organizations.name`. Same rule everywhere; no schema change, no new table, no permission change.

Frontend
- `src/utils/templateUtils.ts` — add `'client.name'` to `PlaceholderData`, add `clientName` option to `buildPlaceholderData`, add the `Client` entry to `PLACEHOLDER_OPTIONS`, relabel `organization.name`.
- `src/utils/placeholderUtils.ts` — add `client.name` to `AVAILABLE_PLACEHOLDERS` (category `Client`) so the composer picker shows it.
- `src/components/settings/PlaceholderHelper.tsx` — add `{{client.name}}` row, relabel the organization row.
- `src/hooks/useBulkSendEmail.ts`, `src/hooks/useBulkRejectCandidates.ts`, `src/hooks/useApplicationReview.ts` — pass `clientName: job.organization?.name` into `buildPlaceholderData`. The bulk hooks already select `organization:organizations!inner(name)`; add that select to the application-review query if missing.
- `src/utils/offerLetterUtils.ts` — add `{{client.name}}` mapped to `data.organization?.name` (offer letters already pass the job's client org there), leaving the existing `{{organization.*}}` keys untouched for backwards compatibility.

Edge functions
- `supabase/functions/send-user-email/index.ts` — extend the job select to `organization_id`, look up the client org name, and add `client.name` to the placeholder map. Also fill the currently-missing `organization.name` (tenant name) and `department.name` (job's department) in the same map so single sends stop dropping them.
- `supabase/functions/public-submit-application/index.ts` — add `{{client.name}}` from the job's `organization_id`, and correct `{{department.name}}`, which today wrongly reads the client organization; it should read the job's department instead.
- Any stage-automation send path that reuses `send-user-email` inherits the fix automatically; a grep pass confirms no other resolver hardcodes its own list.

Verification: typecheck + build, and a render check that `{{client.name}}` resolves in a template preview with a job attached and renders empty without one.

## Not included

- No changes to what `{{organization.name}}` resolves to.
- No client location/website/legal-name placeholders.
- No database migration and no CRM data edits.
