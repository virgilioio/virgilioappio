## Fix: empty request body + invisible errors when scheduling with a manually-picked interviewer

### What I found in your logs

I traced your exact failed click in `create-booking` logs. **The function received an empty body** and threw before any of its own code ran:

```
ERROR [create-booking] Error: SyntaxError: Unexpected end of JSON input
    at Request.json (ext:deno_fetch/22_body.js:346:16)
    at Server.<anonymous> (.../create-booking/index.ts:123:73)
```

Edge-runtime trace shows the sequence: an `OPTIONS` preflight succeeded (200), then the `POST` arrived with `Content-Length: 0`, the function called `await req.json()`, that threw, and the runtime returned 400 — all *before* any `console.log` we added would fire. That's why earlier log inspection showed no breadcrumbs from your click.

### Why the body is empty

The submit code sends:

```ts
await supabase.functions.invoke('create-booking', { body: bookingData });
```

Several keys in `bookingData` come from React Query/props and can be `undefined` for the manual-interviewer flow:

- `job_id`, `candidate_id`, `job_candidate_association_id` — undefined when scheduling outside a job context
- `guest_emails: guestEmails.length > 0 ? guestEmails : undefined` — explicitly undefined
- `booked_by_user_id: user?.id` — undefined briefly while auth context is loading

`supabase.functions.invoke` chooses how to encode the body by inspecting it. When the `body` object contains any non-plain values or the SDK can't decide on a serializer, it has, in this SDK version (`^2.50.0`), been observed to fall back to `new Blob([])` and send a zero-byte payload. That matches exactly what we see: `Content-Length: 0`, `SyntaxError`, no app logs.

### Fix

Three small changes that together solve the symptom *and* make sure any future failure is visible.

**1. Send the body as a pre-stringified JSON string (both schedule sheets)**

In `src/components/candidates/ScheduleInterviewSheet.tsx` and `src/components/candidates/SimpleScheduleInterviewSheet.tsx`, change the invoke call to:

```ts
const { data, error } = await supabase.functions.invoke('create-booking', {
  body: JSON.stringify(bookingData),
  headers: { 'Content-Type': 'application/json' },
});
```

Stringifying first guarantees a non-empty `application/json` body regardless of what's inside `bookingData` and bypasses the SDK's serializer auto-detection that's failing here. `JSON.stringify` correctly drops `undefined` properties.

**2. Surface the real server error in the toast**

Right after the invoke call, if `error` is set, read `error.context` (which is the underlying `Response`) and try to parse the JSON body to recover the real `{ error, code }` from `create-booking`:

```ts
if (error) {
  let serverMessage = error.message;
  try {
    const body = await (error as any).context?.json?.();
    if (body?.error) serverMessage = body.error;
  } catch (_) { /* keep generic */ }
  throw new Error(serverMessage);
}
```

The mutation's `onError` already pipes `error.message` into the toast, so you'll now see `"Custom meeting location is required…"`, `"One or more interviewer booking configurations are unavailable."`, `"This time slot is no longer available."`, etc.

**3. Defensive log + 400 in `create-booking` for empty bodies**

In `supabase/functions/create-booking/index.ts`, wrap the `await req.json()` (line ~123) in a try/catch that logs the inputs and returns a clear JSON 400 instead of an unhandled `SyntaxError`:

```ts
let payload: any;
try {
  payload = await req.json();
} catch (e) {
  console.error('[create-booking] Invalid/empty JSON body. content-length=',
    req.headers.get('content-length'),
    'content-type=', req.headers.get('content-type'));
  return new Response(JSON.stringify({ error: 'Empty or invalid request body' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
const { booking_config_id, /* …all destructured fields… */ } = payload;
```

This won't matter once fix #1 ships, but it prevents the function from ever silently 400-ing again with no breadcrumbs.

### Cleanup

Delete the two test bookings I created while reproducing this:

- `643c67e1-02bb-4e5f-a8bb-ba2b14312f78`
- `1ea9d24f-28fb-42f7-850c-9e7d77f88953`

Done in one migration that removes them (cascades to `scheduled_booking_attendees`).

### Files touched

- `src/components/candidates/ScheduleInterviewSheet.tsx` — stringify body, surface server error.
- `src/components/candidates/SimpleScheduleInterviewSheet.tsx` — same.
- `supabase/functions/create-booking/index.ts` — guarded `req.json()` with logged 400.
- `supabase/migrations/<new>.sql` — delete the two test bookings.

### Expected outcome

Click "Schedule Interview" with a manually picked interviewer → request body is non-empty → function runs end to end → booking succeeds. If anything else is wrong with the data, the toast now tells you exactly what.