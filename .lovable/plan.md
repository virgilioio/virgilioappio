# Match candidate hero card size to job hero card

The two heroes diverge in **width** (because of an extra wrapper around the candidate hero) and in **height** (because of the large avatar + extra meta row stacked on the identity block). Matching them requires aligning both the container chrome and the hero's internal mass.

## What's different today

**Job page (`src/pages/JobDetail.tsx` L851 / L883):**
- Page shell: `h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col … overflow-hidden`
- Hero card sits directly in the shell (no inner wrapper), classes: `mb-3 bg-white border border-virgilio-border rounded-2xl shadow-sm px-6 pt-5`
- Identity row has no avatar → total card height ≈ title(36) + meta(20) + tabs ≈ short

**Candidate page (`CandidateProfileSheet.tsx` L1062 / L1089 + `ProfileHeroCard.tsx` L71/L135):**
- Page shell (`asPage`): `min-h-[calc(100dvh-4rem)] bg-background` (different top-bar offset)
- Hero is wrapped in `<div className="px-4 sm:px-6 pt-4 sm:pt-6 bg-muted/20 space-y-4">` — adds outer gutters and a tinted band the job page doesn't have
- Hero card classes: `bg-white border border-virgilio-border rounded-2xl shadow-sm px-5 sm:px-6 pt-5` (no `mb-3`)
- Identity row has a 96px avatar (`h-20 w-20 sm:h-24 sm:w-24`) + title + meta line + ghost-button row (Full profile / LinkedIn) → noticeably taller

## Plan

### 1. Container parity (`CandidateProfileSheet.tsx`)
- Change the `asPage` shell (L1062) from `min-h-[calc(100dvh-4rem)] bg-background` to `h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col bg-background overflow-hidden` — same as JobDetail.
- Change the inner content wrapper (L1089) from `px-4 sm:px-6 pt-4 sm:pt-6 bg-muted/20 space-y-4` to a plain `space-y-3` (no horizontal padding, no tinted band, no top padding) — so the hero card sits flush against the shell exactly like JobHero does.
- Add `mb-3` either on the wrapper or as the hero card's bottom spacer to mirror JobDetail.
- Note: the modal/overlay variant (non-`asPage`) keeps its current chrome — no change.

### 2. Hero card padding parity (`ProfileHeroCard.tsx` L71)
- Change `px-5 sm:px-6 pt-5` → `px-6 pt-5` (drop the responsive shrink so it matches JobHero exactly).

### 3. Hero card height parity (`ProfileHeroCard.tsx` identity row)
Reduce the candidate identity row to roughly the same vertical mass as JobHero (which has no avatar):
- Shrink avatar from `h-20 w-20 sm:h-24 sm:w-24` (text `2xl/3xl`) → `h-14 w-14` (text `xl`). 56px matches the title+meta block height closely.
- Change identity row alignment from `items-start` → `items-center` so the smaller avatar centers against the name+meta block.
- Drop the secondary `mt-2` action row (Full profile + LinkedIn ghost buttons) from the hero — this row is the main extra height. Move LinkedIn into the meta line as a small inline icon link, and drop "Full profile" (it's redundant on the page view; keep it in the overlay variant only via a prop if needed). If you want zero functional change, alternative: keep the row but switch the buttons to `size="xs"` already exists — the savings are smaller, ~24px instead of ~52px.
- Result: identity row collapses from ~130px to ~52px, matching JobHero's identity row.

### 4. Right-cluster parity
- Already added Advance/Schedule/Email + AI Fit chip in the previous turn. No change needed; with `items-center` they'll align with the smaller avatar/title row cleanly.

### Decision needed

The height match hinges on what to do with the avatar and the secondary action row:
- **A. Full match (recommended).** Avatar 56px, drop the Full profile / LinkedIn ghost row (LinkedIn becomes a small inline icon next to the name).
- **B. Soft match.** Keep avatar at 80px, keep the ghost row but make it `xs` and inline. Card stays ~20–30px taller than JobHero.
- **C. Width-only.** Only fix the wrapper (step 1+2). Heights still differ by ~50px because of the avatar.

I'll go with **A** unless you say otherwise.

## Files touched

- `src/components/candidates/CandidateProfileSheet.tsx` — `asPage` shell + inner wrapper.
- `src/components/candidates/profile/ProfileHeroCard.tsx` — card padding, avatar size, row alignment, drop secondary action row (or relocate LinkedIn inline).

## Out of scope

- Stages card, Quick Actions sidebar, tab content, status banners.
- The non-`asPage` overlay/modal variant of the candidate profile (sheet usage from kanban etc.).
- Any backend/data changes.
