# Candidate Profile — Tabs Redesign (Mockup Parity)

Reorganize the body of the candidate profile page so it matches the mockup: a **single horizontal tab strip** (Job overview · Resume · Overview · Scorecards · Activity · Comments) styled exactly like the job profile, with content rendered in cards in a two-column layout (main content left, Quick Actions + Application sidebar right).

## Tab Strip — match Job Profile

Replace the current `CandidateNameCard` tabs with a `Tabs` + `TabsList` + `TabsTrigger` strip identical to `JobSetupPanel.tsx`:
- `TabsList` styled to match the underlined-tab pattern shown in the mockup (icon + label, count badges, purple dot for unread).
- Tabs (in order): **Job overview**, **Resume**, **Overview**, **Scorecards** *(count)*, **Activity** *(count)*, **Comments** *(count + unread dot)*.
- Add **Offer** as a leading tab only when `associationStatus` is `offer` or `hired` (preserves current behavior).
- Drop the second `CandidateNameCard` from the right column (the right-side mini tab strip with Insights/Emails/Notes/Reminders/Feed). All those concerns move into the unified left-side tabs (Activity = Feed + Emails timeline; Comments = Notes; Insights folded into Overview).

## Layout

Two-column grid below the hero card:

```text
┌─────────────────────────────────────┬──────────────────┐
│ Tabs strip (full width above grid)  │                  │
├─────────────────────────────────────┤  Quick Actions   │
│                                     │  ──────────────  │
│   Active tab content (cards)        │  Application     │
│                                     │  (Source, Comp,  │
│                                     │   Work auth, …)  │
└─────────────────────────────────────┴──────────────────┘
```

- Left column: `lg:col-span-2`, holds the tab content cards.
- Right column: sticky `ProfileQuickActionsCard` + `ProfileApplicationCard` (already built).
- Remove the legacy "Controls Card" rows on both columns — those actions already live in `ProfileActionBar` and the Quick Actions sidebar.

## Tab Content (each in a `Card` matching job profile spacing)

1. **Job overview** — Current stage card (`Current stage · X` with "Open stage" link), Next event + Interviewers cards, Scorecards summary card.
2. **Resume** — existing `CandidateResumeViewer` block, unchanged.
3. **Overview** — Profile Summary, Skills, URLs, Attachments (flatten accordions into stacked cards to match mockup).
4. **Scorecards** — full Scorecards list (`Compare` + `Add` actions in card header), reusing the list currently embedded in Job overview.
5. **Activity** — `ActivityFeedList` + `EmailHistoryList` in stacked cards.
6. **Comments** — `CandidateComments` card.
7. **Offer** (conditional) — existing `CandidateOfferDetails` / `CandidateOfferApprovals` subtabs.

## Files to change

- `src/components/candidates/CandidateProfileSheet.tsx` — replace the body section (~lines 1170–1880): swap the two `CandidateNameCard` tab strips for a single `<Tabs>` + `<TabsList>`, restructure to a 2-col grid with sidebar (`ProfileQuickActionsCard` + `ProfileApplicationCard`), reorganize tab content as cards above. Remove the duplicate Controls Cards.
- `src/components/candidates/profile/ProfileTabs.tsx` *(new)* — small wrapper rendering the styled `TabsList` with icon + label + optional count/dot, so the strip matches the job profile visual language.
- `src/components/candidates/profile/ProfileQuickActionsCard.tsx` & `ProfileApplicationCard.tsx` — wire real data (shells already created).

## Out of scope

- No backend changes, no new hooks. All data sources already exist (`useActivityFeed`, `useCandidateComments`, scorecards hooks, etc.).
- Hero card, top bar, action bar, and stage strip stay as-is.
