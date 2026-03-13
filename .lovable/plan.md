

# WhatsApp Chat Tab Visual Updates

## Changes

### 1. Add background image to chat area
Copy the uploaded image to `src/assets/whatsapp-chat-bg.png`, then use it as a background on the messages `ScrollArea` container with `background-image`, `background-size: cover`, and slight opacity so messages remain readable.

### 2. Replace "Send Template" button with circular icon button
Change the template send button from a full-width green button with text to a circular Virgilio purple icon button (same style as the freeform send button), using the `Send` (paper plane) icon. Both send buttons become consistent circular purple buttons.

## File changes

| File | Change |
|------|--------|
| `src/assets/whatsapp-chat-bg.png` | Copy uploaded image |
| `src/components/candidates/WhatsAppChatTab.tsx` | Add background image to messages area; replace full-width "Send Template" button with circular `size="icon"` button in Virgilio purple (`bg-virgilio-purple hover:bg-virgilio-purple/90`); also update freeform send button to same purple styling |

