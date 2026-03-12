

# Fix WhatsApp Template Honesty and Usability

## Problem 1: Templates falsely marked "approved"

The 5 GoGio seed templates have `approval_status: 'approved'` in the DB but no `twilio_content_sid` — they were never submitted to Meta. Settings shows them with a green "approved" badge, which is misleading.

### Fix

**Settings card (`WhatsAppIntegrationCard.tsx`):**
- In `TemplateCard`, derive the displayed status from actual state: if `twilio_content_sid` is null, show "Not submitted" regardless of `approval_status` in DB.
- Only show "Approved" badge when `twilio_content_sid` is present.
- Add a status mapping: no SID → "Not submitted" (gray), SID + approved → "Approved" (green), pending → "Pending review" (yellow).

**DB cleanup (optional):** Update the 5 seed templates to `approval_status: 'draft'` since they haven't been submitted. But the UI fix above is the primary safeguard.

## Problem 2: Users don't understand `{{1}}`, `{{2}}`

The `variable_mapping` data already exists (e.g., `{1: "candidate_name", 2: "recruiter_name"}`). We just need to surface it.

### Fix for custom template creation (`WhatsAppIntegrationCard.tsx`)

Replace the cryptic `{{1}}` instructions with a **named placeholder system**:
- Show a dropdown or chip selector with predefined variable names: "Candidate Name", "Recruiter Name", "Company Name", "Job Title", "Interview Date".
- When user clicks a variable chip, insert `{{candidate_name}}` (human-readable) into the textarea at cursor position.
- On save, auto-convert `{{candidate_name}}` → `{{1}}` and build the `variable_mapping` automatically.
- Update the help text from "Use {{1}}, {{2}}..." to "Click a variable below to insert it into your message."

### Fix for template display everywhere

- In `TemplateCard` (settings) and chat template picker, show the resolved preview using `variable_mapping` labels instead of raw `{{1}}`.
- E.g., instead of `"Hi {{1}}, this is {{2}} from {{3}}"`, show `"Hi [Candidate Name], this is [Recruiter Name] from [Company Name]"`.

## Files to change

1. **`src/components/settings/WhatsAppIntegrationCard.tsx`**
   - `TemplateCard`: derive display status from `twilio_content_sid` presence
   - Template creation dialog: replace `{{1}}` instructions with named variable chips and auto-mapping

2. **`src/components/candidates/WhatsAppChatTab.tsx`**
   - `getPreviewText` already resolves variables for the chat preview — no change needed there
   - Template list items: already show resolved preview — confirm no change needed

3. **`supabase/functions/manage-whatsapp-templates/index.ts`**
   - On `create`: accept `variable_mapping` built from named placeholders, convert `{{candidate_name}}` → `{{1}}` in `body_template` server-side

## Summary

Two targeted fixes: (1) honest status badges derived from actual Twilio submission state, (2) human-readable variable insertion replacing cryptic numbered placeholders.

