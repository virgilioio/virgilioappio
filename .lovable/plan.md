## Goal

Two fixes to the Deals kanban card:

1. Owner avatar shows "?" instead of the assigned owner's initials/name.
2. The card layout deviates from the standard Pipeline `CandidateCard`. Restructure it to match exactly.

---

## 1. Fix owner "?" bug (`src/hooks/useDeals.ts`)

`enrichDeals` queries `members` for `user_first_name`, `user_last_name`, `user_avatar_url` — those columns don't exist on `members` (only `user_email` does). The lookup returns nothing, so `owner_name` / `owner_avatar_url` stay null and the card falls back to "?".

Change `enrichDeals` to resolve owners through `profiles` (the same source `useCustomerMembers` and most owner resolvers use):

- Query `profiles` by `user_id IN (ownerIds)` selecting `user_id, first_name, last_name, email, avatar_url`.
- Build `owner_name` from `${first_name} ${last_name}`.trim() with email fallback.
- Map `owner_avatar_url` from `avatar_url`.

No schema changes, no other hook changes.

---

## 2. Restructure `DealCard` to match `CandidateCard` exactly (`src/components/deals/DealCard.tsx`)

Mirror the layout from `src/components/jobs/CandidateCard.tsx` (the kanban card used in the Job Pipeline):

- **Wrapper:** `<Card className="relative p-4 min-h-32 bg-white border-border cursor-pointer">` with `role="button"`.
- **Top-right badge** (absolute `top-2 right-2`): the deal age `Xd` rendered as `<Badge variant="secondary" className="gap-1">` with a `Clock` icon — same slot/treatment as the interview-date badge on `CandidateCard`.
- **Header block** (`flex items-start justify-between gap-3`):
  - Title (deal `title`) as `font-medium text-sm text-text-primary truncate`.
  - Subtitle line below (`mt-1`, `text-xs text-text-tertiary`): organization name (or "No company" placeholder, matching the "No LinkedIn" pattern).
- **Bottom row** (absolute `left-4 right-4 bottom-3 flex justify-between items-center gap-2`):
  - **Left:** amount as `<Badge variant="outline">` showing `{symbol}{amount} {currency}` — fills the same slot as `timeInStageLabel`.
  - **Right:** owner badge as `<Badge variant="secondary" className="gap-1 text-[10px] px-1.5">` containing a small `Avatar` (h-3 w-3 / fallback initials) plus the owner's first name (or "Unassigned" when null) — same slot/treatment as `statusBadge`. Wrapped in `Tooltip` showing the full owner name + email.

Remove the current ad-hoc layout (large amount in body, full avatar bottom-right, age top-right as plain text). Keep `onClick` behaviour and the existing props surface unchanged.

No changes to drag-and-drop wiring (`KanbanPrimitives.tsx`), to the kanban board, or to data hooks beyond item 1.

---

## Files

- Edit `src/hooks/useDeals.ts` — switch owner enrichment from `members` to `profiles`.
- Edit `src/components/deals/DealCard.tsx` — rewrite layout to mirror `CandidateCard`.

No DB migrations, no new dependencies.