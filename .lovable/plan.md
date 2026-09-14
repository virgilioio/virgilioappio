# Fix: Alejandra's invite acceptance error

## What actually happened

Her invitation is fine. The record for `alejandra@virgilio.tech` was created today 19:50 UTC, status `invited`, email `sent`, valid until Sep 21 — untouched.

What failed is the account creation on the last step. There is no user account for her email at all, and the sign-up service rejected two attempts at 20:01 UTC from app.gogio.io with:

> Password is known to be weak and easy to guess, please choose a different one.

The invite page only checks that a password is at least 6 characters, so her password passed our check and was then refused by the service. Our page has no wording for that specific refusal, so she saw the vague message "Failed to accept invitation. Please try again." — with nothing telling her the password was the problem. Trying again with the same password would fail forever.

## The fix

On the invite acceptance page:

1. **Say what's wrong.** When the service refuses a password as weak/easy to guess, show a clear message on the password field itself: the password was rejected as too easy to guess, please choose a stronger one. No generic toast, and the form stays filled in so she just changes the password.
2. **Catch it before submitting.** Raise the on-page minimum to 8 characters and require a mix (letters plus a number or symbol), with the requirement shown under the field as she types. This matches what the service actually accepts and stops the round trip that produced her error.
3. **Keep everything else identical** — same invite validation, same account creation, same invitation acceptance step, same redirect, same "already registered" path.

Nothing needs to change for Alejandra's invite itself: once the page gives her the right guidance, her existing link still works. If she'd rather not wait, she can retry now with a longer, less common password.

## Technical notes

- File: `src/pages/AcceptInvite.tsx`
  - `validateForm()` — password rule 6 → 8 chars plus a letter/number-or-symbol check; add helper text under the password input.
  - `handleAcceptInvitation()` — add a branch for `signUpError.message` matching `weak` / `known to be weak` / error code `weak_password`, mapping it to `setErrors({ password: ... })` instead of rethrowing into the generic toast.
  - Same mapping in the outer `catch` message list, so any wrapped variant is also worded correctly.
- No database, edge function, invitation-token, or permission changes.
