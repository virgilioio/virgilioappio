

# Gate WhatsApp UI Surfaces Behind Active Connection Status

## Summary

All WhatsApp UI surfaces should only be visible when WhatsApp is actively connected (`is_active === true` AND session is `connected` or `syncing`). Currently, these surfaces are always rendered regardless of integration status.

## State Model

Add a new computed property `isEnabled` to `useWhatsAppConfig` that returns `true` only when `isActive && isConnected`. This single boolean gates all WhatsApp UI visibility.

## Changes

### 1. `src/hooks/useWhatsAppConfig.ts`
- Add `isEnabled` computed: `isActive && isConnected`
- Export it from both `useWhatsAppConfig` and `useWhatsAppSessionState`

### 2. `src/components/jobs/JobDetailFloatingSidebar.tsx`
- Accept new prop `isWhatsAppEnabled?: boolean` (default `false`)
- Only include the WhatsApp tab in `allTabs` when `isWhatsAppEnabled` is true

### 3. `src/pages/JobDetail.tsx`
- Import and call `useWhatsAppConfig` to get `isEnabled`
- Pass `isWhatsAppEnabled={isEnabled}` to `JobDetailFloatingSidebar`
- Conditionally render the WhatsApp `TabsContent` only when enabled

### 4. `src/components/candidates/CandidateProfileSheet.tsx`
- Import `useWhatsAppConfig` and get `isEnabled`
- Conditionally include the "Chat" tab in the `CandidateNameCard` tabs array only when enabled
- Conditionally render the WhatsApp icon buttons next to phone numbers only when enabled
- Hide the `WhatsAppChatTab` rendering when not enabled

### 5. `src/components/candidates/IndependentCandidateProfileSheet.tsx`
- Same pattern: gate WhatsApp icon buttons next to phone numbers behind `isEnabled`

### 6. `src/components/layout/NotificationCenter.tsx`
- Filter out `whatsapp` type notifications when WhatsApp is not enabled

## Technical Notes
- Uses the existing `useWhatsAppConfig` hook — no new data fetching
- `isEnabled = isActive && isConnected` means: workspace has opted in AND session is live
- If disconnected/expired/error → all WhatsApp UI disappears cleanly
- Settings/Integrations page is NOT gated (that's where the user connects)

