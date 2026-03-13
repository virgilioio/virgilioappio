

# WhatsApp Tab Redesign — Split-Panel Layout with Custom Icon

## Changes

### 1. Use WhatsApp icon in floating sidebar
Replace the `MessageSquare` lucide icon in `JobDetailFloatingSidebar.tsx` with the existing `whatsapp-icon.png` asset (the black one already in `src/assets/`). Render it as an `<img>` tag instead of an Icon component, with appropriate sizing and color inversion for the active state.

### 2. Redesign WhatsApp tab as a split-panel layout (like the reference screenshot)

Transform `WhatsAppConversationsList` into a two-panel WhatsApp experience:

**Left panel** — Conversation list (similar to current, but styled tighter):
- Conversations listed with candidate avatar/initial, name, last message preview, timestamp, unread badge
- Selected conversation gets a highlighted background
- Search/filter bar at top (optional future)

**Right panel** — Active conversation or empty state:
- **Empty state** (no conversation selected): Gio empty-state illustration (`gio-empty-state.png`) with friendly copy like "Select a conversation to start chatting" — branded, premium feel
- **Conversation selected**: Embed the existing `WhatsAppChatTab` component, passing the selected candidate's data. This opens the real chat inline (not via the candidate profile sidebar)

**Layout**: Side-by-side flex layout inside a Card. Left panel ~320px fixed width with border-right. Right panel fills remaining space. Full height of the content area.

### 3. Wire up conversation selection
- Track `selectedConversationId` state in the component
- When a conversation is clicked, show the `WhatsAppChatTab` in the right panel with the candidate's details
- The `onOpenCandidate` prop remains available for opening the full candidate profile if needed (e.g., via a header link in the chat)

## Files

| File | Change |
|------|--------|
| `src/components/jobs/JobDetailFloatingSidebar.tsx` | Import `whatsappIcon` asset, use `<img>` instead of `MessageSquare` for the WhatsApp tab |
| `src/components/jobs/WhatsAppConversationsList.tsx` | Full rewrite: split-panel layout with conversation list on left, chat/empty-state on right, using `WhatsAppChatTab` for active conversations |
| `src/pages/JobDetail.tsx` | Remove the wrapping `<Card className="p-6">` around WhatsApp tab content (the component handles its own layout now) |

