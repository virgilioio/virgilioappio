

# Phone Normalization During Resume Parsing

## Current Behavior
- The `parse-resume` edge function extracts phone numbers via AI (prompt says "Include country code if present") with a regex fallback that captures whatever format is in the resume.
- The AI may return `+52 1 333 255 5660`, `(333) 255-5660`, or just `3332555660` depending on the resume content.
- This raw value flows directly into candidate creation (bulk upload, manual form, public application) without sanitization or country code inference.
- The `PhoneInput` component already parses E.164 values and auto-selects the country code dropdown, but only when editing -- not during initial creation from parsed data.

## What Needs to Change

### 1. Sanitize phone in `parse-resume` edge function
**File:** `supabase/functions/parse-resume/index.ts`
- After AI extraction (and regex fallback), run the phone through a sanitizer that strips all non-digit/non-plus characters.
- Update the AI prompt to explicitly request E.164 format: "Return phone in E.164 format with country code, e.g. +5213332555660. No spaces or dashes."

### 2. Infer country code from location when missing
**File:** `supabase/functions/parse-resume/index.ts`
- Add a small lookup map: country name/code to phone country code (e.g., "Mexico" -> "+52", "United States" -> "+1", "India" -> "+91", etc., covering ~30 common countries).
- After parsing, if the phone has no `+` prefix AND a location was extracted, look up the country code from the location and prepend it.
- If no location match, default to `+1` (US) as a safe fallback -- the user can correct in the form.

### 3. Sanitize in bulk upload flow
**File:** `src/hooks/useBulkCandidateUpload.ts`
- Import `sanitizeToE164` from `@/utils/phoneUtils`
- Apply it to `parsed.phone` before passing to `addCandidate` (around line 120 where candidateData is built)

### 4. Sanitize in `parseAndUpdateCandidate` flow
**File:** `src/hooks/useResumeParsing.ts`
- Apply `sanitizeToE164` to `parsed.phone` before updating the candidate record in the `contact_phones` field

### 5. Sanitize in public application form
Search for any place where parsed resume phone flows into candidate creation and apply the same sanitization.

## Summary
The edge function will return clean E.164 phones. When country code is absent, it infers from the parsed location. All client-side flows also sanitize as a safety net. The `PhoneInput` component already handles display correctly when it receives clean E.164 values.

