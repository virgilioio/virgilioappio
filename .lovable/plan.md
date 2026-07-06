## Goal

In the Job Wizard → Step 1 → Job Description field, when the user clicks **Generate with Gio**, also send any text already present in the Job Description textarea to the AI so it can be used as notes / rough draft to nurture the generated output. All other behavior stays exactly the same.

## Understanding

Yes — I understand. Today the wizard sends the full `jobData` object to the `generate-job-description` edge function, but the function's prompt builder (`buildContextBlock`) ignores `jobData.description`. So even though the text technically travels, it is dropped before hitting the model. We need to surface it into the prompt.

Also, the current UX asks "Replace the current description with an AI-generated one?" whenever the field has >20 chars. Since the whole point is now to *seed* the generation with those notes, that confirm would fire every time and feel wrong. I'll remove that confirm so the notes flow through silently (the field is replaced by the newly generated draft, which now incorporates the notes).

## Changes

### 1. `supabase/functions/generate-job-description/index.ts`
- In `buildContextBlock`, append the user's existing description (if any, trimmed, non-empty) as a distinct block labeled as author notes / rough draft — kept clearly separate from the structured field list so the model treats it as source material to expand, not as a field to echo.
- Add a short instruction line to the system prompt: if "Author notes / rough draft" is provided, treat it as the recruiter's own notes — preserve their intent, facts, and any specifics they mention (tools, responsibilities, must-haves), and expand/polish rather than discard.
- No other prompt, model, or response changes.

### 2. `src/components/jobs/wizard/JobInfoStep.tsx`
- Remove the "Replace the current description…" `window.confirm` in `handleGenerateDescription` (lines 169–173), since the existing text is now intentional input, not something being clobbered.
- No change to the request payload — `jobData` already carries `description`.

## Out of scope

- No UI/label/placement changes to the Generate button, textarea, or wizard layout.
- No changes to other steps, other edge functions, or the non-wizard `JobFormSheet` path.
- No changes to model selection or response handling.

## Verification

- Type-check.
- Manually: open Job Wizard → step 1 → type "Need strong Rust + Tokio background, remote EU only, must have led a team of 3+" into Job Description → fill Title + Level → click Generate with Gio → confirm the produced markdown reflects those notes (Rust/Tokio, remote EU, team lead) instead of ignoring them.
