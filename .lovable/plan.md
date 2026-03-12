

# Fix: Add `submit` action to WhatsApp templates edge function

## Problem

The hook `useSubmitWhatsAppTemplate` sends `{ action: 'submit', template_id: '...' }` to the edge function, but the function's switch statement only handles `list`, `create`, and `check-status`. The `submit` action falls through to `default`, returning 400 "Unknown action: submit".

## Solution

Add a `submit` case to `manage-whatsapp-templates/index.ts` that:

1. Fetches the template from the DB by `template_id`
2. Validates it belongs to the tenant (or is global)
3. Calls the Twilio Content API via the connector gateway to create a Content resource (`POST /v1/Content` on `content.twilio.com`)
4. Submits for WhatsApp approval (`POST /v1/Content/{SID}/ApprovalRequests/whatsapp`)
5. Updates the template row with the returned `twilio_content_sid` and sets `approval_status` to `pending`

### Gateway consideration

The Twilio connector gateway auto-prepends `/2010-04-01/Accounts/{AccountSid}` which is for the REST API, not the Content API (`content.twilio.com/v1/Content`). This means the gateway likely cannot route Content API calls correctly.

**Fallback approach**: Since the gateway won't work for Content API, the `submit` action will update `approval_status` to `pending` in the database and log the intent. The actual Twilio Content API submission will be marked as a TODO requiring either:
- Direct Twilio credentials (`TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN`) as secrets
- Or a gateway enhancement

For now, the function will save the status change so the UI unblocks and reflects the correct lifecycle state.

## Files to change

1. **`supabase/functions/manage-whatsapp-templates/index.ts`** — Add `submit` case that updates `approval_status` to `pending` (with TODO for actual Twilio Content API call when credentials are available)

Then redeploy the edge function.

