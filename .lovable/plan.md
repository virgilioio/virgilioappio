## Problem

`generate-job-description` returns **Markdown** (per its prompt: "Output MARKDOWN ONLY"), but the Public Description editor in `PostingSheet.tsx` is a `RichTextEditor` that treats `value` as **HTML**. So raw Markdown gets pushed straight in, and inside a contenteditable all newlines collapse to whitespace — producing the single-blob, no-spacing text the user sees. Saving that blob then breaks the public page (which renders the stored value with `markdownToHtml` / `SafeHtml`).

The same issue exists in `JobInfoStep.tsx` and `JobPostingStep.tsx` (wizard) which also call `generate-job-description` and push the markdown into rich-text editors.

## Fix

Convert AI Markdown → HTML at the boundary, before it touches the editor and before it's saved. We already have `src/utils/markdown.ts` (`markdownToHtml`) used by `SafeHtml` consumers; reuse it.

### 1. `src/components/jobs/postings/PostingSheet.tsx` — `handleGenerateDescription`
- After `data?.description` arrives, run `const html = markdownToHtml(data.description)`.
- `setDescription(html)` instead of the raw markdown.
- Keep `setIsExternalUpdate(true)` so RichTextEditor reloads.

### 2. `src/components/jobs/wizard/JobPostingStep.tsx` (rewrite button) and `src/components/jobs/wizard/JobInfoStep.tsx` (draft button)
- Same one-line conversion before assigning to the editor / form state.

### 3. Defensive load path in `PostingSheet.tsx`
- When hydrating `setDescription(p.description || '')` at line 146, detect legacy rows that were saved as raw Markdown (no HTML tags but contains `##` / `*` / `-` bullets) and run `markdownToHtml` once so existing broken postings render correctly in the editor on open. `markdownToHtml` already no-ops on real HTML, so this is safe.

### 4. No backend change
- Leave the edge function prompt as-is (markdown is a clean intermediate format and other callers may rely on it). All conversion happens client-side.

## Why this works

- Editor receives proper `<h2>`, `<ul>`, `<li>`, `<p>` — paragraph breaks, bullets and headings render as the user expects and can be edited safely.
- Saved value is HTML, identical to what the public page already renders through `SafeHtml`, so the public posting stays intact when the user edits.
- Existing postings stored as raw Markdown get auto-upgraded on next open (and re-saved as HTML on next save).

## Out of scope

- Changing the rich text toolbar or schema.
- Touching `generate-job-description` prompt or other Markdown-returning AI endpoints.
