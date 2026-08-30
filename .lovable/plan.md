# Cancel & delete a reference check — module list board 09

Adds two destructive row actions to `/references`, each with its own computed confirm dialog, plus a fifth `Cancelled` tab. Everything else on board 09 stays as built in Flow E.

## What already exists (verified)

- `src/pages/References.tsx` renders the tab strip from `refPredicates` and the rows via `ReferenceRequestsTable` (last column 40px, chevron only).
- `refPredicates` in `src/lib/references/status.ts` has four buckets; `all` currently returns `true` and there is no `cancelled` bucket.
- `useTenantReferenceRequests` (`src/hooks/useReferenceList.ts`) filters cancelled requests out at the query (`.neq('state','cancelled')`), so they are currently unreachable in the list.
- `useCancelReferenceRequest` does a client-side `state = 'cancelled'` update only — it does not revoke tokens, stop referee statuses, or write an activity row. No delete mutation exists.
- The public pages already render a `cancelled` terminal state (`reference-public` returns `status: "cancelled"`; both public pages handle it), and the reminder cron already skips cancelled requests.
- `reference_requests` has no `cancelled_by` column — the "who and when" line comes from the `reference_activity` row, which the list hook already surfaces as `lastActivity`.
- `usePermissions` has `canViewReferences` only.

## 1 · Row menu (frontend)

`ReferenceRequestsTable.tsx`:

- Last column 40px → **68px** in the single shared `GRID` string (header + rows stay identical).
- Right-aligned cell holds a 26px `⋮` trigger (`aria-label="Row actions"`, `#F1F0EC` background when open) then the chevron, `gap: 2px`.
- Absolute dropdown (208px min-width, radius 10, spec shadow) rendered inside a wrapper that `stopPropagation`s on click so opening it never opens the request.
- Items with optional second-line hint, `#B42318` danger tone, disabled `#B5B9C4` with no hover, one divider before the destructive group.
- Contents by state: `Open request` · `Resend` (active) / `Request again` (not active) · `Share report` (disabled + `Nothing submitted yet` when nothing submitted) · divider · `Cancel request` (active only, hint `Revokes links, keeps answers`) · `Delete permanently` (always, hint `Destroys N references` / `Removes the record`).
- Active = `draft · candidate · referees · partial · attention`, derived from the row's derived `state` (a new `isActiveRefState()` helper in `status.ts`, used by the menu and the dialog alike).
- Cancelled rows render at `opacity: 0.62`, keep the `Cancelled` pill, and show the existing `lastActivity` line (`Cancelled … by …`).
- Menu items that the recruiter lacks permission for are omitted, never disabled.

`References.tsx`: page container gets `position: relative` and an `onClick` that closes any open menu, so the dialog overlay's `inset: 0` and click-away both work.

## 2 · Confirm dialog

New `src/components/references/CancelDeleteReferenceDialog.tsx` — one component, two modes, spec chrome (460px panel, radius 16, overlay `rgba(13,13,9,0.28)` with `inset: 0`, overlay closes / panel stops propagation).

- Amber `ban` medallion for cancel, red `trash-2` for delete; title and subtitle naming candidate · role at client.
- Consequence lines **computed** from the row's referees: `live = invited|opened|in_progress`, `submitted = submitted|logged`. Cancel shows revoked links (pluralised `1 referee link` / `N referee links`), reminders stopped, then either "keeps the N references already submitted" or "nobody who hasn't answered will be contacted again", then the re-request line. Delete shows destroyed-answer count or "Permanently deletes this request", revoked links, removal from profile and reporting, and the minimal audit record.
- Delete with `submitted > 0` also shows the red "consider cancelling instead" steer — advisory only, the button stays enabled.
- Footer: `Keep it` (secondary) + `Cancel check` / `Delete permanently` (danger), with a loading state on the confirm button.

## 3 · Tabs

In `status.ts`:

- `all` becomes `r => r.state !== 'cancelled'`; add a fifth `cancelled` predicate. `RefBucket` gains `'cancelled'`.
- Counts and rows keep coming from the same predicate object; the header `count` prop switches to `refPredicates.all`, and the amber meta becomes `{attention} need attention` or the neutral `Nothing needs attention` at zero.
- `useTenantReferenceRequests` drops its `.neq('state','cancelled')` filter so cancelled rows are fetchable, and preserves the stored `cancelled` state through derivation (derivation currently ignores it — cancelled/expired stored states win over derived ones for display).
- Filtered-empty block is replaced with the spec card: `No cancelled checks` / retention line on the cancelled tab, `Nothing here` / `Try a different filter.` elsewhere.

## 4 · Server side

Extend `supabase/functions/reference-request-actions/index.ts` with two actions (same RLS visibility pre-check that already guards the referee actions):

**`cancel_request`** — set `state='cancelled'`, `cancelled_at=now()`, `flagged=false`; null the candidate token hash and expiry and every live referee token hash; set referees not in `submitted`/`logged` to `cancelled`; clear the candidate's un-submitted `self_assessment` draft and un-submitted referee `draft_answers` (the public cancelled copy promises nothing was kept); insert a `reference_activity` row `Cancelled by {recruiter}`. Reminders stop automatically because both cron passes already skip cancelled requests. Sends no email.

**`delete_request`** — insert a minimal `audit_logs` row first (`action: 'reference_request_deleted'`, `record_id`, `new_values` = candidate id, request id, deleter, destroyed-answer count — no answer content), then hard-delete referees, activity and the request. Tokens die with the rows, so live links fall through to the ordinary expired card — nothing reveals a deletion. Sends no email.

Both are invoked through new `useCancelReferenceRequest` (rewritten to call the function instead of updating the row directly) and `useDeleteReferenceRequest` mutations in `src/hooks/useReferenceRequests.ts`, invalidating the existing `['reference-requests']` keys. The existing card-level "Cancel request" button keeps working through the same rewritten hook.

## 5 · Permissions

`usePermissions` gains `canCancelReferences` (admins, owners, platform admins, ATS members) and `canDeleteReferences` (held tighter: admins, owners, platform admins). Missing permission hides the item.

## Technical notes

- New file: `src/components/references/CancelDeleteReferenceDialog.tsx`.
- Edited: `ReferenceRequestsTable.tsx`, `src/pages/References.tsx`, `src/lib/references/status.ts`, `src/hooks/useReferenceList.ts`, `src/hooks/useReferenceRequests.ts`, `src/hooks/usePermissions.ts`, `supabase/functions/reference-request-actions/index.ts`.
- No migration: `cancelled_at` exists, the "who cancelled" line comes from `reference_activity`, and the deletion record goes to `audit_logs`.
- Untouched: public pages and their cancelled/expired states, reminder cron, `reference-report`, every email template.
