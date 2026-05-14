# Candidate Profile — Sidebar removal, Top bar, Quick Actions fix, Comp ask

## 1. Remove the associated-jobs left sidebar

**File:** `src/components/candidates/CandidateProfileSheet.tsx`

- Delete the `<CandidateJobSidebar … />` block (lines ~1082–1090) and remove the `import { CandidateJobSidebar }` at line 10.
- Drop the now-unused `handleJobChange` handler if nothing else references it.
- Keep the `CandidateJobSidebar.tsx` file in the repo for now (no other consumers — safe to leave for cleanup later, or delete in this pass).

## 2. Restore the top bar exactly like the mockup

The `ProfileTopBar` component already exists and is rendered at line ~1101, but the visual matches the mockup partially. Update it to match exactly:

**File:** `src/components/candidates/profile/ProfileTopBar.tsx`

- Left: `← Back to job` link button (already there) — keep styling, Poppins 13px, hover text-primary.
- Center: breadcrumbs `Jobs › {jobTitle} › Candidates` (already implemented) — make visible at `md:flex`, keep truncation.
- Right: `7 of 18` counter + two icon buttons (chevron left/right) using `<Button variant="secondary" size="sm" iconOnly>` — already in place.

**File:** `CandidateProfileSheet.tsx`

- Confirm the `<ProfileTopBar />` wrapper renders at the top of the main column. With the sidebar gone, the main column becomes the full width — ensure the surrounding `<div className="flex-1 flex flex-col min-w-0">` still applies and the top bar sits inside `border-b border-virgilio-border bg-white/60` so the back/breadcrumb/nav row is visible above the hero card.
- Pass `currentIndex`, `totalCount`, `hasPrev`, `hasNext`, `onNavigatePrev`, `onNavigateNext` through (already wired).

## 3. Fix the black-on-black "Advance to …" Quick Action button

**File:** `src/components/candidates/profile/ProfileQuickActionsCard.tsx`

Per the style guide (`docs/style-guide.md` §2), `variant="primary"` is citron-noir `#0d0d09` background with **cream `#fffcf9` text**. The current `<Button variant="primary">` should already render correctly — the bug is that the surrounding component or class is overriding the foreground.

- Remove any extraneous `className` that could leak black text (none on this button currently — verify).
- Ensure the `Button` component's `primary` variant in `src/components/ui/button.tsx` sets `text-[#fffcf9]` and `[&_svg]:text-[#fffcf9]`. If it doesn't, fix the variant definition so every `primary` button across the app gets the correct contrast (same fix that was applied inline in `ProfileActionBar` previously — promote it to the variant).
- After the variant fix, drop any one-off `!text-[#fffcf9]` overrides in `ProfileActionBar.tsx` so the style guide is the single source of truth.

## 4. Comp ask shows real salary expectations

The candidate already carries `salary_amount`, `salary_currency`, `salary_period` (see CandidateProfileSheet line 661–663).

**File:** `src/components/candidates/CandidateProfileSheet.tsx` (line ~1719)

Replace:
```tsx
compensation={(candidate as any)?.salary_expectation || null}
```
with a formatted string built from the structured fields, e.g.:
```tsx
compensation={formatSalaryExpectation(candidate)}
```

**File:** add helper in `src/lib/candidateHelpers.ts` (or inline):
- Input: `{ salary_amount, salary_currency, salary_period }`.
- Output: `"$185k / yr"`, `"€90k / yr"`, `"$50 / hr"`; returns `null` if no amount.
- Use `Intl.NumberFormat` with the currency, compact notation for yearly figures (`>= 1000` → `Xk`), and a short period suffix (`yr`, `mo`, `hr`).

If the candidate has a min/max range (check schema for `salary_min`/`salary_max`), render `"$185k – $210k / yr"` like the mockup. I'll verify the column names in `candidates` before writing the helper.

## 5. Out of scope

- No backend or RLS changes.
- Hero card, stage strip, action bar, tabs unchanged.
- `CandidateJobSidebar.tsx` file kept (orphaned) — can be deleted in a follow-up.

## Files touched

- `src/components/candidates/CandidateProfileSheet.tsx` (remove sidebar, swap compensation prop)
- `src/components/candidates/profile/ProfileQuickActionsCard.tsx` (verify primary button)
- `src/components/ui/button.tsx` (ensure `primary` variant has cream foreground)
- `src/components/candidates/profile/ProfileActionBar.tsx` (drop inline color overrides)
- `src/lib/candidateHelpers.ts` (new `formatSalaryExpectation` helper)
