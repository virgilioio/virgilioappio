# Job Overview tab — Current Stage + Scorecards cards

Replace the legacy "Job Overview" accordion (all stages collapsed with scorecards inside) on the **Job overview** tab of the candidate-in-job profile with the two focused cards from the reference. The stage navigation already lives in the strip above the tabs (`ProfileStageStrip`), so the tab body should now be about the *current* stage only.

## Scope

Tab body (`activeTab === 'job'`) inside `CandidateProfileSheet.tsx` — left column only. Right rail (Quick actions, Application, Job information) stays as-is. Hero card and stage strip above stay as-is.

## What to build

### 1. `CurrentStageCard.tsx` (new)
`src/components/candidates/profile/CurrentStageCard.tsx`

```text
┌─ Current stage · Onsite                          Open stage ↗ ─┐
│  In stage 3d · started May 12                                  │
│                                                                │
│  ┌─ NEXT EVENT ──────────────┐  ┌─ INTERVIEWERS ─────────────┐ │
│  │ ┌────┐ Portfolio review   │  │ (avatars) 4 panelists      │ │
│  │ │MAY │ Thu · 2:00 PM ET   │  │           3 scorecards in  │ │
│  │ │ 16 │ 45 min             │  │                            │ │
│  │ └────┘                    │  │                            │ │
│  └───────────────────────────┘  └────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

Props: `stageName`, `stageType`, `inStageDays` (number), `startedAt` (date), `nextBooking` (from `useStageBookings`), `interviewers` (avatars + count), `scorecardsSubmittedInStage`, `onOpenStage` (jumps to / expands current stage detail or pipeline).

Behavior:
- Header uses `text-h4` Poppins; meta uses `text-caption` text-tertiary; "Open stage" is a `Button variant="link"` with `iconRight={ArrowUpRight}`.
- Sub-tiles use `bg-[#FAFAF7]` (or `bg-virgilio-cream`) `rounded-xl` `p-4`; section labels are `text-form-label` (10.5px caps tracking 0.06em).
- Date block: dark square (`bg-text-primary text-white rounded-lg`) with month caps + day; uses `date-fns` for formatting.
- Avatar stack reuses existing `<AvatarStack>` (–8px overlap, +N).
- Empty states (no next event / no interviewers): muted single-line "No upcoming event" / "No interviewers yet".
- For **screening / interview** stages only — for non-interview stages, hide the two sub-tiles (or show a single full-width tile with `stage_description`).

### 2. `StageScorecardsCard.tsx` (new)
`src/components/candidates/profile/StageScorecardsCard.tsx`

```text
┌─ Scorecards                                  [⊞ Compare] [+ Add] ┐
│  3 submitted · 2 pending                                         │
│                                                                  │
│  ┌─ TB  Tom Bell  [Hiring manager]                ● Strong yes ──┤
│  │     2d ago                                                    │
│  │     "Best portfolio I've seen for this role…"                 │
│  ├──────────────────────────────────────────────────────────────  │
│  │ AL  An Le  [Panel]                              ● Yes         │
│  │     2d ago                                                    │
│  │     "Strong systems thinking and craft…"                      │
│  ├──                                                          ── │
│  │ JK  Jo Khan [Panel]                             ● Lean yes    │
│  ├──                                                          ── │
│  │ MR  Maya Reyes                                  ● Pending     │
│  │     Recruiter · pending submission                            │
│  └──────────────────────────────────────────────────────────────  │
└──────────────────────────────────────────────────────────────────┘
```

Wraps existing `useAllStageScorecards(currentStageInstanceId, associationId)` already imported in the sheet. Each row:
- 28px avatar (initials) · name (Poppins 13px) · role pill (`<Badge tone="neutral" size="xs">`).
- Time-since (concise `Xd` per memory).
- Decision badge (right-aligned, `tone` map: `strong_yes` → green, `yes` → green, `lean_yes` → yellow, `lean_no` → orange, `no` → red, `strong_no` → red, pending → yellow with dot).
- Italic comment quote on second line (`text-body-sm text-text-secondary line-clamp-2 italic`), clicking the row opens the existing scorecard sheet via `onOpenFullSheet`.
- Counts derived from scorecards array (`submitted = scorecards.filter(s => !s.is_ai_draft && s.rating).length`, `pending = panelists - submitted`).
- Top-right actions: `Compare` (existing flow if any, else hidden when <2 submitted) and `+ Add` (opens scorecard composer for current user, mirrors the existing "Submit Scorecard" button).
- Empty state: "No scorecards submitted yet" + a primary "Submit scorecard" CTA.
- Hide entirely if current stage doesn't `supportsScorecard`.

### 3. Wire into `CandidateProfileSheet.tsx`
Replace lines ~1203–1378 (current `activeTab === 'job'` block) with:

```tsx
{activeTab === 'job' && currentStage && (
  <>
    <CurrentStageCard
      stageName={currentStage.stage.stage_name}
      stageType={currentStage.stage.stage_type}
      inStageDays={…computed from association.entered_stage_at}
      startedAt={association.entered_stage_at}
      jhsId={currentStage.jhsId}
      candidateId={candidateId!}
      onOpenStage={…scrolls to / opens detail OR navigates to stage}
    />
    {supportsScorecard(currentStage.stage.stage_type) && (
      <StageScorecardsCard
        stageInstanceId={currentStage.jhsId}
        stageName={currentStage.stage.stage_name}
        associationId={associationId!}
        currentUserId={user?.id}
        onOpenFullSheet={(scorecardId) => { /* existing logic */ }}
        onSubmitScorecard={() => { /* existing logic, opens ScoreSheet */ }}
        onCompare={() => { /* TODO if not present, hide */ }}
        onDismissAiDraft={handleDismissAiDraft}
      />
    )}
    {!isRestrictedViewer && candidateId && (
      <ApplicationDetailsCard candidateId={candidateId} jobId={jobId} />
    )}
  </>
)}
```

Keep the existing **Application Details** card below (it already exists). Keep `CandidateDetailsCollapsible` removed from this tab — it was redundant with the hero.

## Out of scope

- Right rail cards (already standardized in prior turn).
- Stage strip / hero (already done).
- Other tabs (Resume, Overview, Scorecards, Activity, Comments).
- Accordion-of-all-stages experience — replaced; no migration needed since stage strip + "Open stage" link cover navigation.
- Mobile compaction beyond what flex-wrap already gives (consultation-first per memory — read-only renders fine).

## Verification

1. Hard-reload `/jobs/:id/candidates/:cid` → Job overview tab.
2. Confirm two new cards render with real data: current stage info, next booking (if any), interviewers (deduped), scorecards from `useAllStageScorecards`.
3. "Submit scorecard" / row click still opens existing `ScoreSheet` (no behavior regression).
4. Non-interview stage (e.g., Application Review) → cards collapse gracefully (no booking tile, scorecards card hidden).
5. Restricted viewer → still sees both cards (read-only), Application Details hidden as today.
