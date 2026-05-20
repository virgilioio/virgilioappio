# Share list with teammates — 4-step centered modal

A new 5th bulk-bar action ("Share") that bundles selected candidates into a named, workspace-internal **list** and shares it with teammates. Heavier than a popover — centered modal with 4 guided steps. External sharing is explicitly out of scope.

## The four steps

```text
[1] Name & describe       [2] Invite teammates       [3] Link & message        [4] Shared
─────────────────────     ────────────────────────   ──────────────────────    ──────────────
List name (req)           Add by name/email          Copyable link (active)    Success state
Description (opt)         Per-person ACCESS          Expiry: 7/14/30d/never    Summary line
Roster preview            Per-person NOTIFY          Block screenshots toggle  Find-it-later
Add more candidates       Internal-only notice       Message + Rewrite w/ Gio  Share another
                                                     Notify-on-comment toggle  Open list
```

### 1. Name & describe (Bundle these candidates)
- Heading "Bundle these candidates", helper "Give the list a clear, scannable name."
- **List name** input (required, autofocus, max 80 chars). Default suggestion: `"<Job title> · <today>"` when all selected come from one job, else `"Shortlist · <today>"`.
- **Description** textarea (optional, 280 chars).
- **Candidates in this list** roster: avatar · name · sub-line (job · stage), fit score chip on the right, X to remove. "+ Add more" opens a small inline picker (search by name) that adds candidates from the same tenant.
- Footer: "N candidates · auto-saved as draft" left, `Cancel` / `Next: who can see it`.

### 2. Invite teammates (Who's reviewing?)
- Helper: "Add anyone in the workspace. Permissions are per-person and changeable any time."
- **Add by name or email** combobox sourced from tenant members (`useCustomerMembers`). Selected people appear as removable chips above the table. Email of a non-member shows a "Pending" chip and is queued as an invite (rendered, not sent in v1).
- **Reviewer table** (3 columns): Reviewer · Access · Notify.
  - Access dropdown: `View only`, `Comment`, `Comment + score` (default).
  - Notify toggle (default on for invited, off for owner row).
  - "You're inviting" badge on the current user (locked to owner).
  - Row overflow `…`: Resend invite · Remove.
- **Internal-only** info banner at the bottom (lilac): "External hiring managers? Use External share instead — different permission model." (External share is a link, not built in v1.)
- Footer: "X invited · Y pending", `Back` / `Next: link & message`.

### 3. Generate link & message (Compose the share)
- Helper: "They get a notification + email. Link works in-app only — login required."
- **Share link** card: status pill "Active", read-only URL `<app>/lists/<slug>`, `Copy` button (clipboard).
- Inline meta row: `Invited reviewers only` · `Expires in [7d|14d|30d|Never]` (select) · `Block screenshots [off]` (toggle, UI-only flag stored on row).
- **Message to reviewers** textarea (optional, 600 chars) with `Rewrite with Gio` button (calls existing `useAIDraftEmail` / Gio rewrite endpoint).
- `Notify me when reviewers comment or score` checkbox (default on).
- Footer line: "Link · 14-day expiry · in-app only", `Back` / `Send & share`.

### 4. Shared (Confirmation)
- Centered check icon, "Shared with N teammates", summary line ("Maya, Sam, and Tom will get a notification in-app and an email with your message.").
- Recap card: list name · "N candidates · N reviewers · expires <date>" · reviewer avatar stack · copyable URL with `Copy`.
- Helper: "Find it later under **Lists → Shared by me** in the left rail."
- Buttons: `Share another` (resets to step 1 with same selection) · `Open list` (navigates to `/lists/<id>`).

## Technical

- **New component**: `src/components/candidates/bulk/ShareListModal.tsx` — `<Dialog>` (`max-w-[640px]`) with internal `step: 1|2|3|4` state machine. Step bar at top (1/4 → 4/4) matches existing popover pattern. Uses design tokens; submit is plain `<Button>` (no variant override).
- **Bulk bar wiring**: extend `BulkActionBar` with `shareButtonSlot?: ReactNode` (mirror of `tagButtonSlot`, `addToJobButtonSlot`). Replace the existing 5th-action slot. `Candidates.tsx` mounts `<ShareListModal candidateIds={selectedIds} candidates={selectedCandidates} />`.
- **Trigger**: `Share` button on bulk bar (icon `Share2`, label `Share`). Replaces — or sits next to — `Add to search`; defer placement to user.
- **Data model** (new):
  - `candidate_lists` (id, tenant_id, owner_user_id, name, description, slug, expires_at, block_screenshots, share_link_active, created_at, updated_at).
  - `candidate_list_items` (id, list_id, candidate_id, added_by, added_at). Unique (list_id, candidate_id).
  - `candidate_list_reviewers` (id, list_id, user_id NULL, invited_email NULL, access enum `view|comment|comment_score`, notify_enabled bool, status enum `pending|active|removed`, invited_by, invited_at). One of user_id / invited_email required.
  - `candidate_list_messages` (id, list_id, author_user_id, body, sent_at) — stores the share message + future comments thread.
  - RLS: tenant-scoped via `user_has_tenant_access(tenant_id)`; reviewer rows readable only by owner + listed reviewer; SECURITY DEFINER trigger to enforce org hierarchy; no CHECK constraints on dynamic state. Slug generation in a `before insert` trigger.
- **Hooks** (new):
  - `useCreateCandidateList` — insert list + items + reviewers in one mutation (Postgres function `create_candidate_list_with_reviewers`).
  - `useTenantMembersForShare` — lightweight select on existing members query, filtered to current tenant, excluding self for the combobox.
  - `useRewriteShareMessage` — wraps existing Gio endpoint (`useAIDraftEmail`) with a "share message" prompt template.
- **Notifications**: on insert of `candidate_list_reviewers` (status=active or pending with email), enqueue email via existing `send-transactional-email` edge function + write a `notifications` row so the in-app bell updates. Reuse `LOVABLE_API_KEY` setup; no new secrets.
- **Sidebar/Lists section**: out of scope for this PR. The success step copy ("Find it later under Lists → Shared by me") implies a forthcoming `/lists` route — track separately. For v1, `Open list` falls back to a minimal read-only page at `/lists/:id` that renders list name + roster (no comments thread yet).

## Out of scope

- External hiring-manager link sharing (different permission model — banner mentions it).
- Comments/scoring inside the shared list page (only the entry point is shipped).
- Editing an existing list's reviewers after the fact (handled in a follow-up screen).
- Sidebar "Lists" section with categories (Shared by me / Shared with me / Drafts).

## Files

- New: `src/components/candidates/bulk/ShareListModal.tsx`
- New: `src/hooks/useCandidateLists.ts` (create + fetch)
- New: `src/pages/SharedList.tsx` + route `/lists/:id` (minimal read-only view)
- Edited: `src/components/candidates/list/BulkActionBar.tsx` (add `Share` action + `shareButtonSlot`)
- Edited: `src/pages/Candidates.tsx` (mount modal)
- Migration: 4 tables + RLS + slug trigger + `create_candidate_list_with_reviewers` RPC
