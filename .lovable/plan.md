

# Fix WhatsApp Compose Area Layout

## Issues
1. Template selector button and send button are stacked vertically — should be on the same line
2. Send button is not perfectly circular — needs explicit `rounded-full` and equal width/height

## Changes — `src/components/candidates/WhatsAppChatTab.tsx`

### 1. Inline template button + send button (lines 267-379)

Restructure the compose area so that when `needsTemplate && !selectedTemplate && !showTemplates`, the template selector button and send button sit side-by-side in the same `flex` row. The template dropdown list still expands above when open.

Move the template button (currently in its own `div`) into the same `flex gap-2` row as the send button when templates are not expanded.

### 2. Perfectly circular send button

Both send buttons (template mode and freeform mode) get:
- `rounded-full` explicitly added
- Fixed `h-10 w-10` (or `h-9 w-9`) to guarantee a circle
- Remove the `size="icon"` prop (which sets non-circular dimensions) and manually size instead
- Keep `bg-virgilio-purple hover:bg-virgilio-purple/90 text-white`

### Resulting layout

```text
Template mode (collapsed):
┌──────────────────────────────────┐ ┌──┐
│ 📄 Select a template to start…  │ │➤ │
└──────────────────────────────────┘ └──┘

Template mode (expanded):  
┌─────────────────────────────────────┐
│ Template 1                          │
│ Template 2                          │
└─────────────────────────────────────┘
                                   ┌──┐
                                   │➤ │
                                   └──┘

Freeform mode:
┌──────────────────────────────────┐ ┌──┐
│ Message candidate...             │ │➤ │
└──────────────────────────────────┘ └──┘
```

