# Fix: "Add member" dialog opens but the screen is frozen

## What you're seeing

Clicking **Add member** in Settings → Members opens the invite dialog, but nothing responds — no typing in the email field, no clicks on role cards or the Send button. That is the signature of a second modal layer sitting invisibly on top of (or beneath) the invite dialog and capturing all pointer and keyboard events.

## Diagnosis status

Not yet confirmed. I could not reproduce it in a live session (this workspace uses an external Supabase project, so I can't sign in to the preview from here), and I will not guess at the cause. What I did confirm by reading the code:

- The invite dialog is built on raw Radix dialog primitives with hand-written overlay `z-60` / content `z-70`, instead of the shared `components/ui/dialog` wrapper.
- Settings → Members mounts the invite component twice: once for "invite" and a second, conditionally mounted copy for "edit member". A conditionally mounted Radix modal that unmounts while still open is a known cause of stuck `pointer-events: none` on `<body>`.
- `SeatLimitUpgradeDialog` is rendered as a sibling inside the same component and uses the shared dialog's identical `z-60/z-70` layers, so when it opens it can land in the same stacking band as the invite dialog.

Any one of these can produce the freeze; which one it is has to be observed, not assumed.

## Step 1 — Confirm the blocking layer

Reproduce in the running app while inspecting the live DOM at the moment the dialog is open, and record:

- computed `pointer-events` on `<body>` and on the invite dialog's content node
- every element with `role="dialog"`, `data-state="open"`, `aria-hidden`, or `inert` and their z-index / stacking order
- which element is actually hit at the center of the email input (`document.elementFromPoint`)

That output names the culprit exactly. If preview sign-in is needed, I'll ask you to sign in once so the session is available.

## Step 2 — Fix, based on what step 1 shows

Whichever of these the evidence points to:

- **Stuck body pointer-events / stale modal:** stop conditionally mounting the second invite instance in the Members tab — keep one always-mounted instance driven by `open`, so Radix runs its own cleanup.
- **Stacking collision:** move the invite dialog onto the shared `Dialog`/`DialogContent` primitives (keeping the current brand styling as classes/inline styles) so overlay and content layering match the rest of the app, and give the nested seat-limit dialog a layer above it.
- **A stray invisible overlay from another source:** remove or scope that overlay.

## Guardrails

- Purely presentational/structural. No change to the invite mutation, role model, seat pre-check, seat-limit error handling, personal message, or members-list refresh.
- The dialog keeps its current look: centered 600px brand card, email chips, role cards, message field, seat-aware footer.
- Same behavior on the standalone Team Members page, which renders the same component.

## Verification

- Open Add member → type emails, add and remove chips, switch role cards, type a message, send an invite.
- Close via X, Escape, and overlay click; confirm the Members page stays fully interactive after each.
- Open Edit member from a row menu, close it, confirm the page is still interactive.
- Trigger the seat-limit path and confirm the upgrade dialog appears above the invite dialog and is dismissible.
