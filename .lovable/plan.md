

# Replace Collapsible Config with a Right-Side Sheet

## Overview

Replace the `Collapsible` detail panel at the bottom of the integrations page with a `Sheet` sliding in from the right. Clicking "Configure" on any integration card opens the sheet with that integration's detail component. The sheet header shows the integration name and logo.

## Changes

### `src/components/settings/IntegrationsTab.tsx`

1. Remove `Collapsible`, `CollapsibleContent`, `ChevronUp` imports
2. Import `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` from `@/components/ui/sheet`
3. Replace the `Collapsible` block (lines 228-244) with a `Sheet` controlled by `activeId`:
   - `open={!!activeEntry}`, `onOpenChange` sets `activeId` to null
   - `SheetContent side="right"` with a wider width (`sm:max-w-lg`)
   - `SheetHeader` showing the integration logo + name
   - Render `<activeEntry.DetailComponent />` inside the sheet body
4. The card's `onConfigure` just sets `activeId` (no toggle — sheet close handles clearing)

### No other file changes

The detail components (`WhatsAppIntegrationDetail`, `ChromeExtensionTokenCard`, `GoogleWorkspaceIntegrationSection`) render inside the sheet as-is — they're already self-contained.

