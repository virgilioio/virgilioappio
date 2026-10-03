# Gio ATS side — Prompt 1: link to Gio Sales (backend)

Gio Sales runs on its own separate backend, so the two apps talk over signed web calls (not shared tables). This step builds everything Gio ATS needs to receive won deals and report opening changes back. The visible screens (Prompt 4) come after Gio Sales finishes Prompts 2–3.

## What you'll get
- When sales marks a deal won, Gio ATS creates a draft job (or adds openings to an existing job) for each success-fee line, with real Req IDs, and replies with them.
- Gio Sales can list a client's jobs and preview the next Req IDs.
- Every change to a deal-linked opening (offer out, offer released, filled with base salary, cancelled, dates changed, job published) is queued and delivered to Gio Sales, retrying until it lands. Failures are kept so admins can see them.
- A job from a deal can never get more openings than the deal's hires.
- Later edits in sales (hires or fee) sync over; reducing hires below what's in use is refused with the Req IDs to cancel.

## Before it can go live
- One shared secret saved as `GIO_LINK_SECRET` in both projects, and `GIO_SALES_URL` here. I'll open the secure form once the endpoints exist.

## Technical details
- **Schema:** `sales_deal_id/title/url/owner/won_at` on `jobs`; `sales_deal_id, sales_line_id, fee_pct, cancelled_at, cancel_reason` on `job_openings`; `sales_company_id` on `organizations` (our client record); new `job_sales_lines(job_id, line_id unique, deal_id, hires, fee_pct)`, `integration_outbox`, `integration_inbox` — service-role only, with admin read on the outbox. All with GRANTs + RLS.
- **Cancelled status:** `job_openings_with_status` gains `cancelled` (when `cancelled_at` set); target-fill-date trigger and open-count logic ignore cancelled rows. Deal-linked openings can't be hard-deleted.
- **Req IDs:** new workspace-level `next_req_ids(tenant, count)` function reusing the existing prefix+number rule, used by deal-won and the preview.
- **Cap trigger** on `job_openings` insert/un-cancel: non-cancelled openings per `sales_line_id` ≤ `job_sales_lines.hires`, error "All {n} hires on the deal are in use. Ask sales to update the deal to add more openings."
- **Outbox triggers** (security definer) on `jobs` (draft→open), `job_openings` (dates, cancelled, filled via `hired_association_id`) and `offer_letters` (reserve/release), only when `sales_deal_id` is set. Filled payload carries accepted offer's base salary + currency.
- **Edge functions** (all verify `x-gio-signature` HMAC-SHA256 over the raw body → 401; inbox idempotency; Zod validation): `sales-deal-won` (one atomic database function does the per-line work; client matched by `sales_company_id`, else created from the name; `existing` mode 422 if job isn't that client's), `sales-company-jobs`, `sales-reserve-req-ids`, `sales-line-updated` (409 with open Req IDs on shrink), and `deliver-integration-outbox` with backoff 1m/5m/30m/2h/12h, run every minute by a scheduled job.
- Record the cross-app rule in AGENTS.md.

## Open points
- Default recruiter / hiring plan per client: I'll reuse existing default stages and the client's recruiter if one is stored; otherwise the job stays unassigned for review.
