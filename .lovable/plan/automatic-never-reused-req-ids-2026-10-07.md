# Automatic, never-reused Req IDs

## Goal
Every new opening — from a Gio Sales won deal or added inside a job — gets its Req ID assigned automatically by the ATS, and a number is never handed out twice (even if an opening is later deleted or cancelled).

## Today
- Inside a job, the openings editor suggests "highest number + 1" from the openings the browser can see, and the Req ID box is editable.
- Gio Sales deals use a database function with the same "highest + 1" rule.
- Both can reuse a number after the highest opening is deleted, and two people adding openings at the same moment can collide.

## What will change
- **One workspace counter** that only ever goes up. It starts just above the highest Req ID ever used in the workspace (keeping the current prefix, e.g. `REQ-1043`).
- **The database assigns the Req ID on save** for every new opening, whatever created it. Anything typed or sent by the browser is ignored.
- **Openings editor (job wizard, Job setup, edit sheet):** the Req ID is shown read-only. New unsaved rows show "Assigned on save"; after saving, the real ID appears. The "already used" Req ID error goes away since it can't happen.
- **Gio Sales:** deal-won openings use the same counter. The "preview next Req IDs" call keeps working as a preview only (real IDs are still given out when the deal is won).
- Existing openings keep their current Req IDs — nothing is renumbered.

## Technical details
- Migration: `req_id_counters(tenant_id pk, prefix, width, last_n)` (service-only, GRANT + RLS, no client access), seeded from max numeric suffix per tenant; `allocate_req_ids(tenant, count)` locks the row (`FOR UPDATE`), increments, returns IDs.
- `BEFORE INSERT` trigger on `job_openings` always sets `req_id` from `allocate_req_ids`; `BEFORE UPDATE` rejects changing `req_id`.
- `sales_deal_won` switched to `allocate_req_ids`; `next_req_ids` (preview) reads the counter without incrementing.
- Frontend: `OpeningsEditor` makes Req ID display-only, drops `nextReqId`/`fetchWorkspaceReqIds`/`isReqIdTaken` checks; `insertOpenings` stops sending `req_id`; refetch after save to show assigned IDs.
- Record the rule in AGENTS.md.

## Verification
- SQL test: concurrent/sequential inserts give unique increasing IDs; deleting the top opening doesn't reuse its number; manual `req_id` in insert is overridden.
- Typecheck + build log clean.
