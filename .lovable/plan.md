
I inspected the current edge function and found the mismatch:

- Your Twilio screenshot shows **WhatsApp approval status: Approved** for Content SID `HX09...`.
- In our code, both `list` auto-refresh and `check-status` read `statusData.approval_requests?.find(...)`.
- Twilio’s approval response uses the **`whatsapp` object** (e.g. `statusData.whatsapp.status`), so our parser never finds a status and DB stays `pending`.

What we should key off:
- **Field:** `whatsapp.status`
- **Expected value for your case:** `"approved"` (case-insensitive)

Implementation plan:

1. Update Twilio status parsing in `supabase/functions/manage-whatsapp-templates/index.ts`
   - In both `case "list"` and `case "check-status"`, replace array-based lookup with `statusData.whatsapp`.
   - Keep a defensive fallback parser (supports both possible shapes) to avoid future API shape surprises.

2. Centralize mapping logic in the same file
   - Add a tiny helper that maps Twilio status → local status:
     - `approved` → `approved`
     - `rejected` / `failed` / `paused` / `disabled` → `rejected`
     - `pending` / `received` / `in-review` (or unknown) → `pending`
   - Use this helper in both polling paths so behavior is identical.

3. Improve observability for this exact bug
   - Add a concise debug log in both paths with:
     - template id
     - content sid
     - extracted Twilio status
     - mapped status
   - This will make future “stuck pending” issues immediately diagnosable from edge logs.

4. Verify end-to-end after deploy
   - Trigger template list fetch and manual “Refresh” once.
   - Confirm DB row updates from `pending` to `approved`.
   - Confirm settings badge changes from **Pending review** to **Ready to use**.
   - Confirm approved template appears in candidate WhatsApp template selector (it filters by `approval_status === 'approved'`).

Technical notes:
- File to change: `supabase/functions/manage-whatsapp-templates/index.ts` (single-file fix).
- Frontend polling (`useWhatsAppTemplates` every 30s when pending) is already correct; it will work once backend parsing is fixed.
