# Mirror JobDetail card structure on candidate profile

## Reference: how `JobDetail` does it

`JobDetail.tsx` (lines 883–907) wraps **JobHero + TabsList together** in one white card:

```tsx
<div className="mb-3 bg-white border border-virgilio-border rounded-2xl shadow-sm px-6 pt-5">
  <JobHero … />
  <TabsList className="mt-4 …">{triggers}</TabsList>
</div>
```

Below it, `PipelineSectionTabs` (the per-job stage selector) sits as its own element.

## Target structure on the candidate profile

```text
┌─ Card 1: bg-white border rounded-2xl shadow-sm px-6 pt-5 ──────────┐
│  Back to job        Jobs › Job › Candidates        7/18 ‹ ›        │
│  ───────────────────────────────────────────────────────────────── │
│  ⬤  Candidate Name.  ♥  [Stage badge]                  ┌──────┐   │
│      Applying for Job · Source · Applied 3d            │AI Fit│   │
│      [Full profile] [LinkedIn]                         │  87  │   │
│  ───────────────────────────────────────────────────── └──────┘   │
│  [Job overview] [Resume] [Overview] [Scorecards] [Activity] [...] │  ← ProfileTabs
└────────────────────────────────────────────────────────────────────┘

┌─ Card 2: stages only ──────────────────────────────────────────────┐
│  ●─●─●─○─○─○                                                       │  ← ProfileStageStrip
└────────────────────────────────────────────────────────────────────┘

  (ProfileActionBar continues to live wherever it lives today —
   NOT inside Card 2. Tab content + sidebar render below as before.)
```

## Implementation

### 1. `ProfileHeroCard.tsx` — restore card chrome, accept tabs slot

- Wrap the existing content in a card: `<section className="bg-white border border-virgilio-border rounded-2xl shadow-sm px-6 pt-5">`. No bottom padding — tabs sit flush so the underline meets the card edge (matches JobDetail pattern).
- Keep the in-hero top nav strip (Back / breadcrumb / pager) already added in the previous round.
- Add a `tabs?: ReactNode` slot rendered after the identity row with `mt-4` (mirrors `JobDetail`).
- The hero itself does NOT contain the stage strip or action bar.

### 2. `CandidateProfileSheet.tsx` — restructure

Currently:
```
ProfileHeroCard (bare)
<section card>
  ProfileStageStrip
  ProfileActionBar
</section>
… later …
ProfileTabs (in scroll body)
… status banners …
tab content
```

New:
```
ProfileHeroCard (carded, with tabs prop = <ProfileTabs … />)
<section card>                   ← Card 2: stages only
  ProfileStageStrip
</section>
ProfileActionBar                 ← restore to its previous location
                                   (back where it sat before the prior edit)
… status banners …
tab content (no ProfileTabs render here)
```

- Lift `<ProfileTabs … />` (currently rendered around line 1198) out of the scroll body and pass it as the `tabs` prop on `ProfileHeroCard`.
- Split the prior wrapper card: keep only `ProfileStageStrip` inside it. Remove `ProfileActionBar` from this card.
- Restore `ProfileActionBar` to its previous render site (immediately after the hero, ungrouped — same position it had before we introduced the wrapping card).

### 3. No changes to

- `ProfileStageStrip.tsx` / `ProfileActionBar.tsx` internals.
- `JobHero` / `JobDetail`.
- `CandidateProfile.tsx` page wrapper.
- Tab content panels, quick actions sidebar, status banners.

## Files touched

- `src/components/candidates/profile/ProfileHeroCard.tsx` — restore card chrome, add `tabs` ReactNode slot
- `src/components/candidates/CandidateProfileSheet.tsx` — pass `<ProfileTabs />` to hero, remove its in-body site, isolate stage strip in its own card, restore action bar to its prior position

## Out of scope

- Overlay-mode behavioral changes (Pipeline overlay).
- Backend / data / RLS work.
- Tab content, quick actions, application card.
