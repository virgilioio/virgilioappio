# Fix: emails with attachments fail to send

## What's happening

The send-email function crashes before it ever reaches Gmail whenever the message is large. The most recent failure in the logs is:

```text
Error in send-user-email: RangeError: Maximum call stack size exceeded
    at base64UrlEncode (send-user-email/index.ts)
```

Sending without attachments works because the message stays small; adding an attachment pushes it over the limit and the send dies with a generic failure.

## Root cause

`base64UrlEncode` in `supabase/functions/send-user-email/index.ts` encodes the whole RFC822 message with:

```ts
btoa(String.fromCharCode(...data))
```

Spreading the byte array as function arguments blows the JS argument-count/stack limit once the message is more than a few tens of KB — exactly what an attachment causes. This is an encoding bug, not a Gmail or quota problem.

## The fix

1. Rewrite `base64UrlEncode` to encode in fixed-size chunks (e.g. 8 KB slices) instead of spreading the entire array, then apply the same URL-safe replacements. Behaviour for small messages is byte-identical.
2. Return a clear error message if the total assembled message exceeds Gmail's ~35 MB raw upload ceiling, so oversize attachments surface as a readable error instead of a silent failure.
3. Redeploy `send-user-email`.

No changes to request shape, attachment validation limits, logging, rate limits, or the client-side composer.

## Verification

- Send a test email with an attachment from a candidate profile and confirm success plus a new row in the email log.
- Check the function logs for the absence of the `RangeError`.
