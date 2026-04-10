

# Fix: "Copy link manually" fallback on booking link copy

## Root Cause

`useStageBookingInterviewers.copyLinkForInterviewer()` creates the booking token **on click** via an async edge function call. This introduces a ~500ms–2s delay between `primeClipboard()` and the actual `copyToClipboardSilent()`. By then, the browser's user-gesture window has expired, so the clipboard write fails and the user sees "Copy the link manually".

In contrast, `useContextualBookingLink` pre-creates the token in a `useEffect` — so the link is ready when the user clicks. No async gap, clipboard works.

## Fix

Pre-create booking tokens for all stage interviewers when the hook data loads, not on click.

### Changes to `src/hooks/useStageBookingInterviewers.ts`

1. After `fetchStageInterviewers` returns the list of interviewers with their booking configs, add a second stage that **pre-creates tokens for each interviewer** using `createShortBookingToken`.

2. Store the pre-created tokens in a `Map<memberId, { token, link }>` via a `useEffect` + `useState` (similar pattern to `useContextualBookingLink`).

3. In `copyLinkForInterviewer`, look up the pre-built link from the map. If found, skip the async token creation entirely — just `primeClipboard()` then immediately `copyToClipboardSilent(prebuiltLink)`. No async gap.

4. If somehow the pre-built link isn't ready yet (race condition / slow load), fall back to the current on-click creation as a safety net.

### Detailed approach

```text
Current flow (broken):
  click → primeClipboard → createToken(async) → copyToClipboard ❌

New flow:
  mount → fetchInterviewers → createTokens for each (async, background)
  click → primeClipboard → copyToClipboard(prebuiltLink) ✅
```

- The `useEffect` watches `interviewers` array + params. When interviewers are loaded, it iterates and calls `createShortBookingToken` for each, storing results in state.
- `copyLinkForInterviewer` checks the pre-built map first. If the link exists, it copies immediately (synchronous within gesture). If not, it falls back to the current async path.

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useStageBookingInterviewers.ts` | Add pre-token-creation on mount; use pre-built links in `copyLinkForInterviewer` |

