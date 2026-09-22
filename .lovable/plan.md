# Luke's "Invalid invitation" message

## What actually happened

Luke's sign-up worked. The records show:

- His account was created at 15:31:58 UTC and he signed in immediately.
- His membership in the workspace flipped to **active** at 15:31:59, with the invite link consumed (the one-time code was cleared, as designed).

So nothing is broken about his access — he is a member, as you noticed.

What he is seeing is the invite link being opened **again after it was already used**. Because the one-time code no longer exists, the page can't find anything to match and falls back to its worst-case wording: a red "Invalid Invitation" card saying the link is invalid or already used. That's alarming and doesn't tell him the truth, which is simply: your account is ready, just sign in.

This happens to anyone who reopens their invitation email after finishing sign-up — a very common thing to do.

## The fix

On the invitation page, when a link has already been used successfully, stop showing a red error and show a reassuring state instead:

- Green check, heading **"You're already set up"**.
- Text: the invitation has already been accepted and the account is active — sign in to continue.
- One primary button: **Sign in**. No "request new invitation" button (nothing needs requesting).
- The email address is shown when we know it, so he knows which account to use.

Keep the existing red card for the two cases where it is genuinely correct: a link that never existed, and an expired link (which keeps its "Request New Invitation" flow untouched).

To tell "already used" apart from "never existed", the page will look up whether a member with that invitation exists and is already active, rather than relying only on the one-time code that gets cleared on acceptance.

Nothing needs doing for Luke himself: he can sign in right now with the password he chose. The page change just stops the scary message.

## Technical notes

- `public.validate_invite_token(token_input)` matches on `members.invite_token`, which acceptance sets to `NULL` — so a reused link returns zero rows and the page renders its generic invalid branch. It already has an `'Invitation has already been accepted'` message path, but that path is unreachable once the token is cleared.
- Add a security-definer read that resolves a used token to an "accepted" outcome. Two options, pick the simpler at build time:
  1. Preserve the token on acceptance and let the existing `user_status != 'invited'` branch fire (touches the accept path — riskier), or
  2. Add a companion function, e.g. `public.invite_token_status(token_input uuid)` returning `('accepted' | 'expired' | 'unknown', invite_email, organization_name)`, reading `members` plus an accepted-token record. Preferred: it leaves the acceptance flow alone.
- `src/pages/AcceptInvite.tsx`: extend `InvitationData` with a `state` of `valid | accepted | expired | unknown`; render a new accepted branch (success icon, sign-in button) above the current invalid branch; leave the expired branch and the form path unchanged.
- No changes to `accept-invitation-with-metadata`, permissions, or member provisioning.
