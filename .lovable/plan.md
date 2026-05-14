# Candidate Profile Hero Refinement

## 1. Top nav strip (ProfileHeroCard.tsx)

- **"Back to job"** — change classes to match breadcrumb exactly: `text-body-sm text-text-tertiary hover:text-text-secondary` (drop `font-poppins text-[13px] tracking-[-0.005em]`). Same font (Inter body), same size as the breadcrumb.
- **Remove the divider** under the top strip: drop `pb-3 mb-4 border-b border-virgilio-border` → use `mb-3` (or `mb-4`) only.

## 2. Hero top-right action cluster (ProfileHeroCard.tsx)

Mirror `JobHero`'s right-side action cluster. Add an actions slot on the right of the identity row containing, in this order:

- `Advance to {nextStageLabel}` — `variant="primary"`, `iconRight={ArrowRight}` (hidden when rejected/hired or no next stage)
- `Schedule` — `variant="secondary"`, `icon={Calendar}`
- `Email` — `variant="secondary"`, `icon={Mail}`

Implementation: extend `ProfileHeroCard` props with `nextStageLabel`, `onAdvance`, `onSchedule`, `onEmail`, `isRejected`, `isHired`. Render the cluster as a `shrink-0` flex group aligned to the top-right of the identity row (replacing/with the AI Fit chip side; AI Fit moves to the left of the buttons or stays — keep AI Fit chip, place buttons after it).

Layout: identity row becomes `flex items-start justify-between gap-4`, with left = avatar + identity block, right = `[AI Fit chip] [Advance] [Schedule] [Email]`.

## 3. Pager / navigation arrows relocation

The top-strip pager (`{index} of {total}` + Prev/Next chevrons) is freed up. Move it to the **right edge of the breadcrumb row**, replacing the now-empty right side of the top strip. Net effect: top strip becomes `[Back to job] · · · [breadcrumb centered] · · · [pager + arrows]` — same three-column distribution as today, just without the divider underneath. No new location needed; the strip stays, only its bottom border is removed.

(If we'd rather free the top strip entirely, alternative is to dock the pager into the hero's top-right above the action buttons — but the current placement reads cleanly and matches the user's prior "left/center/right" requirement.)

## 4. Delete the middle action bar card (CandidateProfileSheet.tsx)

- Remove `<ProfileActionBar />` and its wrapping card entirely from `CandidateProfileSheet.tsx`.
- The file `src/components/candidates/profile/ProfileActionBar.tsx` becomes unused → delete it.
- Quick Actions sidebar (`ProfileQuickActionsCard`) already contains Advance / Submit scorecard / Schedule / Create offer / Reject — no changes needed there.

## Resulting structure

```
[ Hero card ]
  Top strip: Back to job  ·  Breadcrumb  ·  {N of M} ‹ ›
  Identity:  Avatar  Name + meta            [AI Fit] [Advance] [Schedule] [Email]
  Tabs
[ Stages card ]
[ Tab content ]   |  [ Quick Actions sidebar ]
```

## Files touched

- `src/components/candidates/profile/ProfileHeroCard.tsx` — typography fix, remove divider, add action cluster props + render.
- `src/components/candidates/CandidateProfileSheet.tsx` — pass new action props to hero, delete ProfileActionBar card.
- `src/components/candidates/profile/ProfileActionBar.tsx` — delete file.

## Out of scope

Stages card, Quick Actions sidebar, tab content, status banners, overlay mode, any backend/data changes.
