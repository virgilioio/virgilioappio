

# Fix Ingest Email Being Marked as Optional Attendee

## Problem

In `supabase/functions/create-booking/index.ts` line 387, the transcript ingest email is added to the Google Calendar event as an **optional attendee** (`optional: true`). Google Gemini (and similar AI note-takers) only track required attendees — they skip optional ones. This means Gemini never "sees" the ingest email, so transcripts aren't sent to it.

## Fix

**`supabase/functions/create-booking/index.ts`** — line 387

Remove `optional: true` from the ingest email attendee object. Keep `responseStatus: 'accepted'` so it doesn't generate an RSVP prompt.

```ts
// Before
...(transcriptIngestEmail ? [{ email: transcriptIngestEmail, optional: true, responseStatus: 'accepted' }] : []),

// After
...(transcriptIngestEmail ? [{ email: transcriptIngestEmail, responseStatus: 'accepted' }] : []),
```

That's it — one property removal. The ingest email will now appear as a required attendee, which Gemini and other note-takers will recognize and send transcripts to.

## Files

| File | Change |
|------|--------|
| `supabase/functions/create-booking/index.ts` | Remove `optional: true` from ingest email attendee |

