## Confirmation: same function, no new function

Yes — all three entry points already call the **same** shared edge function `generate-job-description`:

- Job Wizard → `JobInfoStep.tsx` (works today)
- Job Wizard → `JobPostingStep.tsx` (works today)
- Posting Sheet (create from scratch on an existing job) → `PostingSheet.tsx` (this is where the error appears)

No new function is created or proposed. The fix stays inside that one shared function plus the client-side error handling.

## Why it fails only from the Posting Sheet

The function requires **both** `title` and `job_level` (returns 400 `insufficient_context` otherwise). In the wizard, users have just filled `job_level` in an earlier step, so the payload always has it. In the Posting Sheet, the underlying job frequently has a `title` but no `job_level` yet, so the same function 400s. On the client, `supabase.functions.invoke` throws a `FunctionsHttpError` whose `.message` is the generic "Edge Function returned a non-2xx status code" — the JSON `message` we returned is discarded, so the user sees an opaque error.

Secondary: the function still targets `google/gemini-2.5-flash`; project default is `google/gemini-3-flash-preview`.

## Fix (shared function, keep it single)

### 1. `supabase/functions/generate-job-description/index.ts`
- Require only `title` in the pre-flight guard (drop `job_level`). The context block already includes every provided field, so the model uses whatever exists — same behavior as the wizard when the field is populated.
- Update `model: "google/gemini-2.5-flash"` → `model: "google/gemini-3-flash-preview"`.
- Leave prompts, sections, CORS, auth, membership check, and 429/402 handling untouched.

### 2. Better error surfacing in the three existing callers
`src/components/jobs/postings/PostingSheet.tsx`, `src/components/jobs/wizard/JobPostingStep.tsx`, `src/components/jobs/wizard/JobInfoStep.tsx` — parse the JSON body from `FunctionsHttpError` before toasting so users see the actual reason (rate limited, credits exhausted, etc.) instead of the generic non-2xx string:

```ts
if (error) {
  let msg = error.message
  try {
    const body = await (error as any).context?.response?.json?.()
    if (body?.message) msg = body.message
  } catch {}
  throw new Error(msg)
}
```

### Out of scope
- No new edge function.
- No prompt or output-shape changes.
- No UI layout changes in the wizard or Posting Sheet.
- No DB/RLS changes.

## Verification

- Posting Sheet on a job with only `title`: click **Draft from job** → description generates (same as the wizard experience).
- **Rewrite with Gio** still shows the replace-confirm prompt, then regenerates.
- Wizard `JobInfoStep` / `JobPostingStep` "Generate with Gio" continues to work identically.
- Simulated 429/402 → toast shows the real message from the function.
