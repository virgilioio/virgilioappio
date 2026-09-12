# Job Dashboard: Refresh shows the narrated generation loader

## Goal

Clicking the refresh button on the Job Dashboard swaps the existing dashboard for the
full narrated loader (phase rows — read / snapshot / analyse / write — streamed prose,
issue cards, elapsed counter), instead of only dimming the current dashboard with a
spinning icon.

## Current behaviour (confirmed in `src/components/jobs/JobBriefingTab.tsx`)

- Refresh calls `load(true)` (line ~855), which sets `refreshing = true` and streams
  events from `generate-job-briefing` with `force: true` (server always regenerates,
  so narration phases always fire).
- The render gate at line 631 only shows `JobDashboardBriefingLoader` during a refresh
  when `refreshing && showLoader && streamProse.length > 0` — i.e. only after prose
  tokens arrive, and only after the 400 ms suppression window. Before that the user
  just sees the old dashboard at 50% opacity with a spinning refresh icon (line 771).
- Cancel during a refresh sets `streamError('Generation was cancelled.')`, which
  discards the previously loaded dashboard and shows an error state.

## Changes

All in `src/components/jobs/JobBriefingTab.tsx`; no server changes.

1. **Show the loader on refresh.** Change the refresh branch of the render gate to
   `refreshing && showLoader` (drop the `streamProse.length > 0` requirement). The
   400 ms fast-path suppression still applies, so quick regenerations don't flash the
   loader; but once the narrative starts, refresh gets the same loader as a first load —
   phases, stat tiles, streamed prose, issue cards, elapsed counter.
2. **Refresh starts narration immediately.** In `load(true)`, set `showLoader` as soon
   as the first `phase` event arrives (the existing `narrativeStarted` logic already
   does this once `delayPassed`; for a forced refresh also flip `delayPassed` to true
   immediately so the loader appears without the 400 ms wait — refresh is a deliberate
   user action, not a speculative load).
3. **Keep the old dashboard underneath while suppressed.** The existing
   `opacity-50` + spinning icon state stays for the sub-400 ms window before the
   loader takes over.
4. **Cancel / error restores the previous dashboard when one exists.** On cancel or
   stream error during a refresh where `data` was already loaded, clear the refresh
   state and keep showing the previous dashboard with a small inline error note (or
   toast) instead of replacing it with the full-screen error loader. The full-screen
   error loader remains only when there is no prior data to fall back to.
5. **On success, replace content.** The existing `complete` event already calls
   `setData(event.payload)`; the loader unmounts and the refreshed dashboard renders.
   No change needed.

## Technical notes

- Files touched: `src/components/jobs/JobBriefingTab.tsx` only.
- No changes to `generate-job-briefing`, the SSE event protocol, caching, or the
  `Payload` shape.
- Loader props (`phases`, `stats`, `prose`, `elapsedSeconds`, `slowAnalysis`,
  `issueCards`, `onRetry`) are already wired and reusable as-is; `onCancel` gains the
  restore-previous-data behaviour.

## Verification

- Open a job dashboard with an existing briefing, click refresh: the narrated loader
  appears with real phase timings and streamed prose, then the updated dashboard.
- Cancel mid-refresh: the previous dashboard returns.
- Force an error mid-refresh: previous dashboard returns with an error note.
- First load on a job with no cached briefing: unchanged behaviour.
