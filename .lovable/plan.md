

# Enlarge Dialog + 2:3:1 Layout + WhatsApp Rich Description

## Changes

### 1. `IntegrationDetailDialog.tsx` — Resize + restructure

- **Size**: `sm:max-w-3xl` → `sm:max-w-5xl` (~25% bigger)
- **Min height**: `min-h-[320px]` → `min-h-[440px]`
- **Column ratio 2:3:1**: Change from 58%/42% to a three-column concept expressed as two visual zones:
  - Left (images): `sm:w-[33%]` (2 parts)
  - Center (description): `sm:w-[50%]` (3 parts) — scrollable
  - Right (actions): `sm:w-[17%]` (1 part)
  
  Actually, a cleaner approach since the actions are just buttons: keep two columns but change the ratio so the description area is dominant. The 2:3:1 ratio (out of 6 parts) means:
  - Images: 2/6 = ~33%
  - Description + Actions: 3/6 + 1/6 = ~67%, with the description taking the bulk and buttons pinned at the bottom

  I'll implement as: Left carousel `sm:w-[33%]`, Right content `sm:w-[67%]` with description scrollable and buttons fixed at bottom-right.

- **Description prop**: Change from `string` to `React.ReactNode` so we can pass rich formatted content

### 2. `IntegrationsTab.tsx` — Update WhatsApp description

Replace the short one-liner with a rich `React.ReactNode` containing the full structured text provided by the user, formatted with headings, paragraphs, and a link. Keep the short description on the card itself (add a `shortDescription` field or keep `description` for cards and add `detailContent` for the dialog).

Approach: Add a `detailContent?: React.ReactNode` field to `IntegrationEntry`. When present, the dialog uses it instead of `description`.

### 3. File summary

| File | Action |
|------|--------|
| `IntegrationDetailDialog.tsx` | Enlarge to `sm:max-w-5xl`, change column ratio to 33%/67%, accept `React.ReactNode` for description, add scroll to description area |
| `IntegrationsTab.tsx` | Add `detailContent` to `IntegrationEntry`, create WhatsApp rich description component, pass to dialog |

