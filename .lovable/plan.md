# Harsh Sampat's Monday interview is hidden behind another event

## What I found

The interview is in the system and perfectly healthy:

- **Harsh Sampat · Mon Sep 21 · 10:30–11:00 (Mexico City)** — confirmed, your name as interviewer, correct stage of Account Executive, Enterprise, Google event created when you booked it on Sep 18. Nothing cancelled it.

The reason you can't see it: **a second confirmed meeting sits in the exact same half hour** — Lucía Santos, 10:30–11:00 the same Monday. The Calendar week grid draws every event stretched across the full width of its day column and has no rule for two meetings at the same time, so whichever one draws last covers the other completely. Harsh's card is underneath Lucía's, pixel for pixel.

This is not specific to Harsh. Any two overlapping meetings in the week view hide one another today, and the week's counter in the header still counts both — so the number says 2 while you can only see 1.

## The fix

Make the week grid lay out concurrent events side by side, the way every calendar does.

- Group the events of each day into clusters of meetings whose times overlap.
- Split the column width between the members of a cluster (2 overlapping = half each, 3 = a third each), with a small overlap so the one behind still peeks out and stays clickable.
- Keep everything else identical: colours per type, the 3px left edge, dashed border for holds, the title and time line, the click-to-open popup, the red "now" line, today's tint.
- When a card gets narrow, drop to the single-line compact form already used for short events so the text never turns to mush.

Scope: presentation only, inside the Calendar page. No data, query, or scheduling-logic changes. Nothing else in the app reads this layout code.

## Verification

- Open the week of Sep 21 with "Mine": both the 10:30 meetings visible side by side, each clickable and opening its own details.
- Harsh Sampat's card is reachable and reads "Interview · Harsh Sampat", 10:30–11:00, Account Executive, Enterprise.
- A day with no overlaps looks exactly as it does now (full-width cards).
- The header count matches the number of cards on screen.

## Separate issue worth knowing about

While looking, I saw that Google Calendar's change notifications are currently being refused for **every** event across all connected accounts (permission errors, continuously). Practically: if you or a candidate moves, deletes, or accepts an event in Google, Gio won't hear about it right now. That's a different repair, on the backend side, and I'd like to confirm before touching it — say the word and I'll plan that next.
