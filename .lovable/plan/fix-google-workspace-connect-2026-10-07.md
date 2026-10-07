# Fix Google Workspace connect

## What I found
- Nobody has connected a new Google account since Sep 22. Jurre still has nothing linked.
- Your account permissions and data are fine. The problem is in the connection steps themselves.
- **Confirmed cause:** the Google sign-in service only accepts requests from **app.gogio.io**. I tested it. From **app.virgilio.io**, the published lovable.app address or the preview, the "Connect" click is blocked before Google even opens. Since December, app.virgilio.io has been missing from the allowed list. The same problem affects 30 other services, including Disconnect, Stripe billing, invitations and password reset.
- **Second weak spot:** after you approve on Google, the popup always goes back to one fixed address. If someone starts on a different address, the popup can't find the sign-in details it needs and the connection quietly fails.
- **Third weak spot:** if the popup can't tell the main window it finished, nothing on screen changes, even when the connection actually worked.
- Today's merge of the two Google screens didn't change these steps. They match the version from before.

## What changes
1. **Accept every real Gio address.** app.gogio.io, app.virgilio.io, the lovable.app addresses and the preview will all work, both for Google and for the 30 other services. Each service answers the address that actually asked.
2. **Come back to the same address.** The popup returns to whichever Gio address you started on, as long as it's on the approved list.
3. **Always show the result.** When the popup closes, the card checks again and shows Connected or the real reason it failed, instead of staying stuck.
4. **Clear error messages.** Failures name the actual problem, for example "Sign-in expired, try again" or "Google didn't grant calendar access", instead of a generic error.

## One thing you may need to do
Google only returns people to addresses listed in your Google Cloud app. If app.virgilio.io isn't listed there yet, I'll give you the exact line to add. Until then, people starting from that address go back through app.gogio.io as they do today.

## After this
I'll test the Connect button from app.virgilio.io and app.gogio.io to make sure Google opens. Then you or Jurre do one real connect so I can confirm his email and calendar show as connected.

## Technical details
- `supabase/functions/_shared/cors.ts`: add `app.virgilio.io`, `auth.virgilio.io` to `ALLOWED_HOSTNAMES`. Change `createSecureCorsHeaders` / `corsHeaders` usage so responses echo the request origin: add a `corsFromRequest(req)` helper and switch the 30 functions that call `createSecureCorsHeaders()` (static fallback = app.gogio.io) to per-request headers. No logic changes otherwise. Redeploy them.
- `mail-oauth-start`: accept `return_origin` from the client. Validate it against `isAllowedOrigin` plus an `OAUTH_REDIRECT_ALLOWED_BASES` list (defaults to `OAUTH_REDIRECT_BASE`). Put the chosen redirect base inside `state` and use it for `redirect_uri`. Also fix the `scopes` variable used out of scope in the debug log.
- `mail-oauth-callback`: rebuild `redirect_uri` from the validated base in `state` so it matches the start step exactly. Return specific error codes (state expired/mismatch, token exchange body, missing scopes, tenant lookup). Keep the 5-minute state window.
- `src/lib/googleWorkspaceConnect.ts`: send `window.location.origin`. Watch `popup.closed` and refetch mail/calendar identities when it closes, then toast success or failure from what's actually stored. Read `FunctionsHttpError` context so the toast shows the real reason. Keep calling `window.open` right after the request (same as before).
- `src/pages/MailOAuthCallback.tsx`: show the specific error text in the popup.
- No database changes. Record the CORS rule in AGENTS.md: edge functions echo the allowlisted request origin, never a fixed default.
