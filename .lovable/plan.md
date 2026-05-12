# Plan: CRM → Deals (MVP Kanban + Profile Sheet)

Confirmed: Supabase only, MVP scope, full adherence to the existing style guide.

## 1. Supabase schema (one migration)

All tables tenant-scoped; RLS via the existing `user_has_tenant_access(tenant_id)` pattern (per Tenant-based RLS memory). No CHECK constraints — validation via SECURITY DEFINER triggers where needed.

**`deal_stages`** — workspace kanban columns (editable in Settings)
- `tenant_id`, `name`, `position` (int), `color` (text, optional), `stage_type` (`open` | `won` | `lost`)
- Seeded per workspace on first read with: New → Qualified → Proposal → Negotiation → Won → Lost.

**`deals`**
- `tenant_id`, `organization_id` (FK → `organizations`, the company)
- `title`, `amount` (numeric), `currency` (text — defaults to workspace currency)
- `owner_id` (FK → auth.users; resolved through `members` for display)
- `stage_id` (FK → `deal_stages`), `position` (int, ordering inside a column)
- `expected_close_date` (nullable), `notes` (text)
- `created_by`, timestamps

**`deal_notes`** — threaded notes (mirrors `candidate_comments`)
- `deal_id`, `author_id`, `body`, timestamps

**RLS** (all three tables): tenant-scoped read/write for active members; restricted viewers (Hiring Managers / Interviewers) get no CRM access.

## 2. Settings — Deal Stages editor

New section in Settings → Workspace, modeled directly on the existing Job Stages editor:
- Reuses the same DnD reorder pattern (CSS Translate, per Smooth DnD memory).
- Add / rename / reorder / delete stages; mark a stage as Won or Lost (`stage_type`).
- Same input heights (44px), Selects (32px), `ring-virgilio-purple` focus, semantic Smart Field badges.

## 3. Routing & Navigation

- New route `/crm/deals` in `src/App.tsx` (lazy).
- Header: keep CRM section with two top-nav items styled identically to ATS items (icon + label + active highlight): **Companies** (`/crm`, `Building2`) and **Deals** (`/crm/deals`, `Handshake`).

## 4. Deals Kanban page (`src/pages/Deals.tsx`)

Visually and structurally a clone of the Jobs pipeline kanban:
- New components in `src/components/deals/`: `DealsKanbanBoard`, `DroppableDealStage`, `DraggableDealCard`, `DealCard`.
- `@dnd-kit` + Translate-based motion; optimistic stage moves with silent background refresh (Kanban optimistic feedback memory).
- Fixed viewport `h-[100dvh]`; standard `PageHeader` (no subtitle).
- Card: deal title (Poppins, tracking -0.06em), company name, amount + currency, owner avatar, age in `Xd` format.
- Empty state: standard Gio mascot.
- Skeletons during initial load (Initial-Load-Only gate per Unified loading gates memory).
- Toolbar: "+ New Deal", search, basic filters (owner, company), saved-views compatible.

## 5. Create / Edit deal — `DealFormSheet.tsx`

Right-side `Sheet` (mirrors `JobFormSheet` / `CandidateFormSheet`), zod + react-hook-form:
- Title, Company (combobox over `useOrganizations`), Amount, Currency (`CurrencySelect`), Owner (workspace member picker), Stage, Expected close date, Notes.
- All controls use the standard heights, focus ring, and badge tokens.

## 6. Deal profile sheet — `DealProfileSheet.tsx`

Sliding sheet modeled on `CandidateProfileSheet`:
- Header: title, company, amount + currency, stage badge, owner avatar, edit / delete.
- Body tabs: **Overview** (key facts, inline edit), **Notes** (threaded `deal_notes` like `CandidateComments`), **Activity** (stage moves + edits via existing `activityLogger`).
- Right rail: Owner, Company link, Created/Updated, quick "Mark Won / Lost" actions.
- Same animation, z-index, and close behavior as the candidate sheet.

## 7. Hooks

- `useDeals` — react-query, tenant-scoped list + filters.
- `useDeal(id)` — single deal joined with company + owner.
- `useDealStages` — list + reorder + CRUD (used by Settings + kanban).
- `useDealMutations` — create / update / move-stage / delete with optimistic kanban updates.
- `useDealNotes` — list / add / delete.

## 8. Permissions

- `canManageCRM` derived from existing system roles. Admin / Owner / Recruiter-equivalent: full access. Hiring Manager / Interviewer: no access (consistent with restricted-viewer memory).

## 9. Style-guide guardrails (applied throughout)

- Typography: Poppins headings (bold, tracking -0.06em); Inter body. No subtitles in `PageHeader`.
- Colors: only semantic tokens from `index.css` / `tailwind.config.ts`. No raw hex/Tailwind color utilities.
- Inputs 44px, Selects 32px, unified `ring-virgilio-purple` focus.
- Badges follow Smart Field semantic colors.
- Empty states: standard Gio mascot.
- Loading: Initial-Load-Only skeletons.
- Time: `Xd` concise format.
- Motion: subtle, calm, premium; DnD via Translate.

## 10. Out of scope (this MVP)

- No Contacts table.
- No Deals analytics / forecasting.
- No email, automation, or AI on deals.
- No changes to the `organizations` schema.

## Build order

1. Migration: `deal_stages`, `deals`, `deal_notes` + RLS + first-read seeding of default stages.
2. Hooks.
3. Settings → Deal Stages editor.
4. `Deals` kanban page + components.
5. `DealFormSheet`.
6. `DealProfileSheet`.
7. Header: Deals nav item + route.
8. Preview QA: DnD, optimistic updates, permissions, empty/loading states.

Approve and I'll start with the migration.
