## Root cause: the previous "fix" is what's now sending an empty body

I read the source of `@supabase/functions-js` (v2.4.4, used by supabase-js 2.50.0). The relevant block in `FunctionsClient.invoke()`:

```js
let body: any
if (
  functionArgs &&
  ((headers && !Object.prototype.hasOwnProperty.call(headers, 'Content-Type')) || !headers)
) {
  // ... assigns body here based on type ...
}
// fetch(... body)  // body is still `undefined` if the condition above was false
```

**The condition is false whenever the caller passes `Content-Type` in `headers`.** That's exactly what we did in the last fix:

```ts
await supabase.functions.invoke('create-booking', {
  body: JSON.stringify(bookingData),
  headers: { 'Content-Type': 'application/json' },
});
```

Result: the SDK skips the body assignment entirely, `body` stays `undefined`, fetch sends a request with `Content-Length: 0`, and the edge function's defensive `req.json()` now correctly returns `"Empty or invalid request body"`. So the toast the recruiter sees is real — the request really is empty, but the cause is our own header.

The original 400 (before any of these fixes) was a different symptom of the same family: the SDK's serialization auto-detection in some edge case. The right shape for v2.50.0 is to pass the raw object and let the SDK stringify and set the header itself. `JSON.stringify` already drops `undefined` properties, so `guest_emails: undefined`, `job_id: undefined`, etc. are not a problem.

## Fix

Change both schedule sheets back to passing the object — but **without** an explicit `Content-Type` header — so the SDK's JSON branch runs:

`src/components/candidates/ScheduleInterviewSheet.tsx` (around line 522):
```ts
const { data, error } = await supabase.functions.invoke('create-booking', {
  body: bookingData,
});
```

`src/components/candidates/SimpleScheduleInterviewSheet.tsx` (around line 369): same change.

Keep the existing error-extraction block that reads `error.context?.json()` so any future server-side validation message (e.g. "Custom meeting location is required") still surfaces in the toast.

Also keep the defensive `try/catch` around `req.json()` in `supabase/functions/create-booking/index.ts` — it's harmless and will keep producing clean 400s with logs if anything similar happens again.

## Why this works for the manual-interviewer + custom-location + guest case

With the object form:
- SDK enters the `else` branch, sets `Content-Type: application/json`, runs `JSON.stringify(bookingData)`.
- `undefined` keys (`job_id`, `candidate_id`, `job_candidate_association_id`, `guest_emails` when empty) are dropped by `JSON.stringify`.
- The non-empty payload reaches the function, `req.json()` succeeds, validation passes (custom location is present, guest emails are an array), booking is created.

## Files touched

- `src/components/candidates/ScheduleInterviewSheet.tsx` — drop `JSON.stringify` and `Content-Type` header from the `create-booking` invoke.
- `src/components/candidates/SimpleScheduleInterviewSheet.tsx` — same.

No edge function or DB changes.

## Verification after deploy

Recruiter flow: open a candidate → Schedule Interview at a stage with no configured interviewer → pick interviewer manually → custom meeting location → add guest email → Schedule. Expected: toast "Interview Scheduled", booking visible in the candidate profile. If anything else is wrong server-side, the toast will now show the specific reason from the function response instead of "Empty or invalid request body".
