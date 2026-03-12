

# Integrations Page Redesign

## Current State
The page is a vertical stack of three full-width sections separated by `<Separator>` — Chrome Extension, Google Workspace, WhatsApp. This works for 3 integrations but won't scale.

## Proposed Structure

Inspired by the reference image, reorganize into a **card grid** with a **search + filter toolbar** at the top. The key difference from the reference: we keep it simpler (no "bundles" or "recommended" sections for now — just "Your Integrations").

```text
┌──────────────────────────────────────────────────────────┐
│  Integrations                                            │
│  Connect external services to enhance your workflow      │
│                                                          │
│  [ 🔍 Search integrations... ]  [⊕ Category]  [⊕ Status]│
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ Chrome Ext   │  │ Google WS   │  │ WhatsApp    │      │
│  │ logo + desc  │  │ logo + desc │  │ logo + desc │      │
│  │ status badge │  │ status badge│  │ status badge│      │
│  │ [Configure]  │  │ [Configure] │  │ [Configure] │      │
│  │         🔘   │  │         🔘  │  │         🔘  │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│                                                          │
│  Integration Detail (expanded below grid when clicked)   │
└──────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. New `IntegrationCard` component (`src/components/settings/IntegrationCard.tsx`)
A uniform card for every integration:
- **Logo** (image or icon), **name**, **description**, **category badge** (e.g., "Communication", "Productivity", "Sourcing")
- **Status badge**: Connected (green) / Not Connected (gray)
- **Toggle switch** (enable/disable, only when connected)
- **"Configure" button** that expands the detail panel or opens a dialog
- Consistent size: 3-column responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)

### 2. Integration registry (`src/components/settings/integrationRegistry.ts`)
A static array defining each integration's metadata:
```ts
{ id, name, description, category, logo, component }
```
Categories: `"sourcing"`, `"communication"`, `"productivity"`
This makes adding new integrations trivial — just add an entry.

### 3. Toolbar with search + filter chips
- Reuse the compact `Input` search pattern from other toolbars
- Reuse `FilterChipPopover` for **Category** filter (Sourcing, Communication, Productivity) and **Status** filter (Connected, Not Connected)
- Filters narrow the visible cards; search matches on name/description
- "Clear filters" inline action

### 4. Detail panel pattern
When user clicks "Configure" on a card, expand a collapsible detail section below the grid (or open a Sheet/Dialog) rendering the existing detailed component (`ChromeExtensionTokenCard`, `GoogleWorkspaceIntegrationSection`, `WhatsAppIntegrationCard`). This preserves all current functionality while keeping the grid view clean.

### 5. Refactored `IntegrationsTab.tsx`
- Renders `PageHeader`, toolbar row, card grid, and expanded detail area
- Uses local state for search query, selected categories, selected statuses, and `activeIntegrationId`
- Filters the registry to determine visible cards

### Files to create
- `src/components/settings/integrationRegistry.ts` — integration definitions
- `src/components/settings/IntegrationCard.tsx` — uniform card component

### Files to modify
- `src/components/settings/IntegrationsTab.tsx` — full rewrite to grid + toolbar layout
- Minor tweaks to existing detail components to work inside the expandable/dialog pattern (wrap in a container rather than standalone sections)

