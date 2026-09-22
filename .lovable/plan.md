# Luke's missing availability — what I found and what to change

## The finding: he never finished connecting Google

I checked Luke's account directly in the live database:

- **No Google connection at all.** There is no calendar connection and no mailbox connection on his account — not an inactive one, not a partial one. His login account only has an email/password sign-in; no Google sign-in is attached either.
- **His scheduling profile is switched off.** Every member gets a scheduling profile when they join; his is still inactive with a UTC working week, which is the untouched default.

So this is not a partial-permissions case. If he had granted only some of the Google permissions, we would still see a connection record on his account marked as failing — there is none. Either the Google window was closed before finishing, or it was done on a different product/account. Nine other members are in exactly the same state; the six people who can be scheduled all have a live Google connection.

**What Luke needs to do:** open Settings → Integrations → Google Workspace, click Connect, and on the Google screen leave **all** the requested checkboxes ticked (mail *and* calendar). Once he does, his scheduling profile turns on by itself and he becomes bookable. I can confirm it from my side afterwards.

## Why nobody could tell

Two things hid the real cause, and both are worth fixing:

1. **The hiring-team screens blame the wrong setting.** When someone can't be scheduled, we tell the recruiter the interviewer must "configure their availability in Settings → Booking". That's misleading — the actual blocker is the Google connection, and Luke reasonably believed he had done what was asked.
2. **On the scheduling sheet he disappears entirely.** The interviewer picker only loads people with an active scheduling profile, so Luke is silently absent rather than shown as "not connected yet". That reads as a bug rather than a setup gap.

## The change I propose

Presentation only — no change to how availability is calculated, no new permissions, no database changes.

- Distinguish three honest states per interviewer and name the real blocker in each: **Google not connected** (no connection at all), **Calendar permission missing** (Google connected but calendar access was not granted), and **Booking turned off** (connected, but they disabled their own booking).
- Point the recruiter to Settings → Integrations → Google Workspace, not Settings → Booking, in the first two cases.
- On the interviewer picker, still list assigned interviewers who can't be booked, greyed out with that reason, instead of omitting them — so a recruiter sees why someone is absent.
- Keep the existing group-booking warning, with the corrected wording.

### Technical notes

- Sources: `src/components/jobs/stage-config/TeamTab.tsx` (status badges and tooltips), `src/components/scheduling/ManualInterviewerSelector.tsx` (drops interviewers without an active config), `src/hooks/useStageBookingInterviewers.ts` (same filter for booking links).
- The state is derived by joining the existing per-user scheduling profile with the user's calendar connection row and its health status; both are already readable by the app.
- `useStageBookingInterviewers` keeps filtering booking-link generation to bookable people; only the visible list and copy change.
