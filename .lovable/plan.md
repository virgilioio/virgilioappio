# Job Dashboard — Make the "Ask Gio" box actually work

Scope: only the Ask box + suggestion chips at the bottom of the Job Dashboard tab (`src/components/jobs/JobBriefingTab.tsx`). No other UI or logic changes.

## Current behavior (verified)

- The `askGio()` helper (line 83) dispatches a `window` `CustomEvent('gio:ask')` and checks `window.__gioChatMounted`. Nothing in the app listens for that event or sets that flag, so both paths always fall through to `navigator.clipboard.writeText(prompt)` + a "Prompt copied — paste it into Gio to continue" toast.
- Suggestion chips (bottom of tab, ~line 902) and the input's submit handler (~line 850) both funnel into `askGio()`, so both trigger the same copy-toast.
- No job-scoped Q&A edge function exists yet. `chat-with-gio` is dedicated to the job-creation wizard and isn't reusable here.

## Target behavior

1. **Clicking a suggestion chip** puts that chip's `prompt` text into the input field, focuses the input, and does NOT auto-send. User can edit before sending.
2. **Submitting the input** (Enter or send button) actually calls an AI backend, streams the reply inline below the input, and shows Gio's answer with basic markdown rendering. The clipboard/toast fallback is removed.
3. Same-tab conversation history is kept in local state so a user can ask follow-ups; switching jobs or unmounting the tab resets it.

## Implementation

### 1. Frontend — `src/components/jobs/JobBriefingTab.tsx`

- Delete the `askGio()` helper and its `useToast` usage for this flow.
- Add local state near the Ask box: `messages: {role, content}[]`, `pending: boolean`, plus the existing `ask` string and a `textareaRef` for focus.
- Suggestion-chip `onClick`: `setAsk(c.prompt); textareaRef.current?.focus()`. No network call.
- Feature-card action buttons (line 793–815): same behavior — populate the Ask input and scroll it into view. (They currently call `askGio` too; user hasn't asked to change those, but they share the helper so removing it forces one branch. Keeping them consistent with the chips is the safe move.)
- Form `onSubmit`: append `{role:'user', content:text}` to `messages`, clear the input, set `pending=true`, then call the new edge function via `supabase.functions.invoke('job-ask-gio', { body: { jobId, jobTitle, question: text, history: messages } })`, append the assistant reply on success, show inline error text on failure. Disable the send button while `pending`.
- Render a conversation panel directly under the input (only when `messages.length > 0`): stacked user/assistant bubbles matching the tab's existing typography (Inter 13.5, cream card background, purple accent for Gio rows), a small typing indicator while `pending`, and a "Clear" ghost link.

### 2. Backend — new `supabase/functions/job-ask-gio/index.ts`

- POST `{ jobId, jobTitle, question, history }`. JWT-verified (uses caller's Supabase JWT to enforce tenant/RLS).
- Load a compact job context server-side with the caller's client: title, department, location, status, stage counts, top rejection reasons — reuse the same reads the tab already performs (`useJobFeatures`/related). Keep the payload small.
- Call Lovable AI Gateway (`google/gemini-3.6-flash`) via the shared provider with a system prompt: "You are Gio, a hiring copilot. Answer the recruiter's question about this job using only the provided context. Be concise, cite numbers, never invent candidates." Include the job context block and prior turns.
- Return `{ answer: string }`. Non-streaming for v1 to keep the change small; the UI shows a shimmer while waiting.
- Follow existing edge-function conventions: CORS headers, `_shared/ai-gateway.ts`, structured errors for 429/402 surfaced to the client.

### 3. Config

- Register the function in `supabase/config.toml` with `verify_jwt = true`.
- No new secrets — `LOVABLE_API_KEY` already exists.

## Out of scope

- No changes to the global topbar "chat with Gio" experience, `useChatWithGio`, or `chat-with-gio` function.
- No streaming/SSE (can be added later if the wait feels long).
- No persistence — conversation is per-tab-mount only.
- No changes to the feature-card copy or the rest of the Job Dashboard tab.
