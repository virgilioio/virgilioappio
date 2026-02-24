

# Fix: Booking Link Copy Fails Silently

## Root Cause

When a user clicks "Copy [Name]'s Link", the system makes an async network call to create a booking token **before** attempting to write to the clipboard. Browsers require clipboard writes to happen within a short window after a user gesture (click). By the time the token API responds, that window has expired.

The code then falls back to `document.execCommand('copy')`, but never checks its return value -- it always returns `true`, so the success toast shows even though nothing was copied.

## The Fix

**Strategy**: Copy a temporary placeholder to the clipboard immediately on click (while the user gesture is still valid), then replace it with the real link once the token is generated. If the second write fails, fall back to showing the link in a dialog the user can manually copy.

### Changes

**1. `src/utils/clipboard.ts`** -- Fix the fallback to check `execCommand` return value, and add a new `copyToClipboardWithRetry` utility:

- Fix `copyToClipboardSilent`: check `document.execCommand('copy')` return value -- if it returns `false`, return `false` instead of `true`
- Add new function `primeClipboard()` that immediately writes a placeholder string to the clipboard (to "prime" the user gesture)
- Add new function `writeToClipboardAfterDelay(text)` that attempts a second write, and if it fails, returns `false`

**2. `src/hooks/useStageBookingInterviewers.ts`** -- Restructure `copyLinkForInterviewer`:

- On click: immediately call `navigator.clipboard.writeText('Generating link...')` (synchronously, before any `await`)
- Then `await createShortBookingToken(...)` 
- Then attempt `navigator.clipboard.writeText(link)` -- if this second write fails (gesture expired), show a toast/dialog with the link text so the user can copy manually
- If the second write succeeds, show the normal success toast

**3. `src/hooks/useContextualBookingLink.ts`** -- Apply the same pattern to the user's own booking link copy flow (same issue exists there, though it may not always hit the async path).

### Technical Details

```text
BEFORE (broken):
  click -> await createToken (500ms+) -> clipboard.write (FAILS - gesture expired) -> fallback execCommand (FAILS silently) -> toast "Copied!" (LIE)

AFTER (fixed):
  click -> clipboard.write("Loading...") (SUCCEEDS - gesture active) -> await createToken -> clipboard.write(link) (may fail) -> if fail: toast with copyable link text
```

### Files Changed

| File | Change |
|------|--------|
| `src/utils/clipboard.ts` | Fix `execCommand` return value check; add clipboard priming utility |
| `src/hooks/useStageBookingInterviewers.ts` | Prime clipboard immediately on click, then overwrite after token creation; show fallback toast with link if second write fails |
| `src/hooks/useContextualBookingLink.ts` | Same pattern for user's own link copy |

