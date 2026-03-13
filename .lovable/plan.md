

# Fix: WhatsApp Marketing Templates Blocked (Error 63049)

## Problem
Your template was categorized as **MARKETING** when submitted to Meta/Twilio. Since April 1, 2025, Meta blocks all marketing template messages to US numbers (+1). This is a Meta policy — not a code bug. Error 63049 confirms the message was rejected before delivery.

## Solution: Two changes

### 1. Remove "Marketing" as a category option
For a recruiting ATS, all WhatsApp templates are transactional in nature (interview scheduling, application updates, candidate outreach). These are **Utility** templates, not marketing. Removing the Marketing option prevents this error entirely.

**File:** `src/components/settings/whatsapp/WhatsAppTemplateCreator.tsx`
- Remove `MARKETING` from the `CATEGORIES` array, keeping only `UTILITY` and `AUTHENTICATION`
- Update the default to stay as `UTILITY`

### 2. Add error 63049 handling in send-whatsapp
When this error occurs, give the user a clear, actionable message instead of a generic Twilio error.

**File:** `supabase/functions/send-whatsapp/index.ts`
- Add `63049` to the `errorMap` with a message explaining that marketing templates are blocked for US numbers and suggesting they use a Utility template instead

### 3. Fix existing template
The template you already created and got approved as "Marketing" — you'll need to delete it and re-create it as a **Utility** template. The category is set at submission time and can't be changed after approval.

## Files to change

| File | Change |
|------|--------|
| `src/components/settings/whatsapp/WhatsAppTemplateCreator.tsx` | Remove MARKETING from CATEGORIES array |
| `supabase/functions/send-whatsapp/index.ts` | Add 63049 to error map |

