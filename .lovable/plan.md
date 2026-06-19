## Plan

1. **Fix status detection for the booking button**
   - Update the token-status hook so it can find the latest token for the candidate/job even when the current association id does not match the token that was copied.
   - Surface the correct state in the button: `Copy ... Link` for valid links, `Renew ... Link` when the latest matching token is expired, and loading only while status/config is actually loading.

2. **Stop copying stale prebuilt links**
   - In the interviewer booking hook, if the status is expired or uncertain, skip the cached/prebuilt URL and mint a fresh token during the click.
   - Clear/rebuild prebuilt links when token status changes so the UI and clipboard stay aligned.

3. **Fix the public schedule page’s token lookup**
   - Trace the `/schedule/:shortCode?t=...` validation path and make it resolve the exact `token + short_code` row first.
   - Ensure a non-expired token like `WWNMS4Xc` is not incorrectly displayed as expired because of association/context mismatch.

4. **Verify with the provided case**
   - Use the candidate/job IDs and copied URL from your example to confirm the button indicates the right state.
   - Confirm the copied URL opens the scheduling flow instead of the expired-link state when the database token has `expires_at > now()`.