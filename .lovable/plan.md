## Scope

Redesign the **in-job** candidate profile so the three terminal statuses — **Offer**, **Rejected**, **Hired** — get (1) a status banner above the hero and (2) a status-specific tab prepended to the tab row and made default. Normal pipeline candidates are untouched. The independent profile, stage stepper, and the content of all other tabs are untouched.

Files this work centers on: `src/components/candidates/CandidateProfileSheet.tsx` (banner + tab wiring), the three existing banner components, `CandidateOfferDetails.tsx` / `CandidateOfferApprovals.tsx` (visual restyle only).

---

## 1 · Shared `StatusBanner` primitive

New `src/components/candidates/status/StatusBanner.tsx`. One compositional component, three tones (`offer` / `hired` / `rejected`) following the exact spec — 40×40 icon chip, eyebrow + dot + meta line, Poppins 16/600 title ending in a colored period, optional sub line with `<strong>` fragments, action slot on the right. Tokens (bg, border, eyebrow color, period color, icon-chip color, shadow, on-dark button remap) live in a `bannerTones` map so the three callers stay declarative.

Delete the standalone `HiredStatusBanner`, `OfferStatusBanner`, `RejectionStatusBanner` files and replace their three call sites in `CandidateProfileSheet` with `<StatusBanner tone=… />`. `statusBannerUtils.ts` (`formatMovedHere`) stays.

---

## 2 · Tab prepending + default selection

In `CandidateProfileSheet.tsx`:

- Derive `terminalStatus: 'offer' | 'rejected' | 'hired' | null` from the existing association status / offer record.
- Build the tab array dynamically: when `terminalStatus !== null`, prepend the matching tab — `offer` → "Offer" (file-text, red dot if awaiting signature), `rejected` → "Rejection details" (x-circle), `hired` → "Onboarding" (check-circle) followed by a read-only "Offer" tab. The existing tabs (Resume, Overview, Scorecards, Activity, Emails, Comments) stay in place after.
- On open / status change, default the active tab to the prepended one (replace the current `useEffect` at line 431). On status reactivation, fall back to `job`/`resume` as today.

---

## 3 · OFFER status (display-only restyle, no schema/chain changes)

**Banner — two states:**
- *Offer drafted/sent:* eyebrow "OFFER" + "Sent {n} days ago · all approvals in", title "Offer is out — awaiting {first name}'s response.", sub with comp fragments pulled from whichever currency fields exist on the offer + "approved {n} of {m}". Actions: secondary "Send reminder", cream primary "Mark hired".
- *Moved to Offer stage, nothing drafted:* the existing hourglass copy, single "Create offer" action.

**Offer tab segmented control:** replace the two pill `TabsTrigger`s (lines 1533–1536) with a compact 2-segment control (container `#F1F0EC` r10 p4, active = white + soft shadow). Labels include progress counts.

**Offer details sub-view (restyle of `CandidateOfferDetails.tsx`):** group offer-form fields by *type* — currency fields lift into a top stat-tile row (OTE-style total gets the accent lilac tile); other short fields render as 2-col icon+label+value pairs in form order with type-driven icons; long text (Job Description) renders full-width with 2-line clamp + purple "Show more". The set of fields rendered is unchanged — only the visual grouping is new.

**Offer approvals sub-view (restyle of `CandidateOfferApprovals.tsx`):** card with progress chip header; one row per approver in chain order (numbered circle whose state reflects approved/current/waiting, avatar, name, role+timestamp, status dot-chip with "Send reminder" on Pending). Terminal "Offer sent to {first name}" row appended after chain completes. Draft state shows the chain with all rows Waiting and a quiet "Approvals start when you submit the offer." line.

**Sidebar additions:** optional `OfferTimeline` mini-dot timeline block built from existing offer events (drafted → each approval → sent → expires); each row omitted if its event doesn't exist. Add the one-line caption "Amending re-runs the approval chain." under quick actions only if that's how the product behaves (verify in `useOfferApprovalChain` before shipping).

---

## 4 · REJECTED status

**Banner:** noted spec, two action buttons wired to the existing reactivate + "move to talent pool" dialogs (the latter is already used in the sheet's rejected-flow elsewhere).

**New "Rejection details" tab content** (`src/components/candidates/status/RejectionDetailsTab.tsx`):
1. *Rejection details* card with 2-col meta grid (Rejected by, When, Stage, Notified Yes/No+channel), "REASON CATEGORY" + chips (primary = red dot-chip, secondaries neutral), "INTERNAL NOTES" `#FAFAF7` block.
2. *Rejection email* card rendered from the email log row if one exists, with green "Opened · {time} later" chip if open-tracking data exists; whole card omitted otherwise.

Data sources already in the sheet: `rejection_reasons`, `rejected_at`, `rejected_by`, `rejection_notes`, `email_logs` row tied to the rejection. No schema changes.

**Sidebar:** Actions block (Reactivate, Move to talent pool, Add to different job, Personal note) + "Other jobs" block using `useJobMatchingCandidates` style data — omit if no matches.

---

## 5 · HIRED status

**Banner:** spec'd green tone with two actions; sub-line fragments reflect actual onboarding-task state from the new table (welcome packet sent, IT provisioning in progress) and omit fragments whose tasks don't exist/aren't done.

**New "Onboarding" tab** (`src/components/candidates/status/OnboardingTab.tsx`):
- Onboarding checklist card with header "{done} of {total} complete · {n} due before start date" + ghost "Add task".
- Live checkbox rows (Inter 12.5px label, owner Inter 11px `#5A6072`, yellow due-date dot-chip on incomplete). Toggle updates the row optimistically and persists.
- Default seed list inserted on first hire for an application: Background check, I-9 verification, Hardware, Welcome packet, Slack + email accounts, Onboarding buddy, Day-1 schedule, 30-60-90 plan, Equity grant. Re-hiring a previously hired application doesn't re-seed.

**Sidebar:** Hire summary meta card (Start date, Title, Location, Total Y1, Reports to, Buddy — values pulled from the existing accepted offer; rows with no value omitted) + Time-to-hire tile (lilac surface, purple Poppins "{n}d", "Application → Hired"). Compute average across the tenant's other hires on demand; show the green "Faster than avg by {n}d" chip only when ≥1 prior hire exists.

The Offer tab that follows Onboarding renders the same accepted-offer view in read-only mode (no "Edit", no "Mark hired").

---

## 6 · Backend (HIRED only)

One migration. Public-schema GRANTs in the same migration, per project rules.

```sql
create table public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.job_candidate_associations(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_label text,
  due_date date,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.onboarding_tasks (application_id, position);

grant select, insert, update, delete on public.onboarding_tasks to authenticated;
grant all on public.onboarding_tasks to service_role;
alter table public.onboarding_tasks enable row level security;

-- RLS scoped via existing tenant helper (mirror pattern from comments/reminders)
create policy "tenant members read"   on public.onboarding_tasks for select to authenticated using (user_has_tenant_access(tenant_id));
create policy "tenant members insert" on public.onboarding_tasks for insert to authenticated with check (user_has_tenant_access(tenant_id));
create policy "tenant members update" on public.onboarding_tasks for update to authenticated using (user_has_tenant_access(tenant_id)) with check (user_has_tenant_access(tenant_id));
create policy "tenant members delete" on public.onboarding_tasks for delete to authenticated using (user_has_tenant_access(tenant_id));
```

Hook: `src/hooks/useOnboardingTasks.ts` (react-query) — list by `application_id`, toggle, add, reorder; seeds the default 9 tasks the first time a hired application is opened (single insert-many guarded by an existence check).

No other backend changes. Offer form schema, approval chain config, rejection reasons, email logs — all untouched.

---

## 7 · What stays exactly as today

- Normal in-pipeline experience, stage stepper, scorecards, activity, emails, comments.
- Offer Form schema (Settings → Offers) and per-job approval chain configuration.
- Independent candidate profile.
- All other tabs' content. No data hidden for rejected candidates — only the lead-in changes.

---

## Build order

1. `StatusBanner` primitive + delete old 3 banners + rewire existing call sites (visual win, low risk).
2. Tab-prepending logic + default-selection rework in `CandidateProfileSheet`.
3. Rejection details tab.
4. Offer tab restyle (segmented control, currency tiles, restyled approvals rows).
5. `onboarding_tasks` migration + hook.
6. Onboarding tab + Hired sidebar.
7. Verify build clean and the route renders for each status.
