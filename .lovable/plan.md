
# Convert Templates to use Tabs sub-navigation (matching Automations pattern)

## Problem
The Templates section in Job Settings uses a `ToggleGroup` for switching between template types (Offer Letters, Email, Contracts, Rejection Reasons, Rejection Templates). The Automations tab uses the standard `Tabs`/`TabsList`/`TabsTrigger` pattern, which looks and feels much better. The user wants consistency.

## Change
Refactor `src/components/settings/OfferTemplatesManager.tsx` to replace the `ToggleGroup` with `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, matching the exact pattern used in `AutomationsTab.tsx`.

### What changes

**File: `src/components/settings/OfferTemplatesManager.tsx`**

1. Replace `ToggleGroup`/`ToggleGroupItem` imports with `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`
2. Remove the `useState` for `templateType` -- Tabs handles this internally via `defaultValue`
3. Restructure the component layout:
   - Move the `Tabs` wrapper to the top level (replacing the outer Card wrapper for the toggle section)
   - Convert each `ToggleGroupItem` into a `TabsTrigger` (removing icons to match Automations style)
   - Wrap each template type's content block in a `TabsContent`
   - Keep the "Create" button inside each `TabsContent` section rather than conditionally at the top
4. Remove unused icon imports (`FileText`, `Mail`, `FileCheck`, `Ban`, `FileX` from toggle items -- keep only those used in empty states)

### Tab mapping

| Current ToggleGroupItem | New TabsTrigger label |
|---|---|
| Offer Letters | Offer Letters |
| Email | Email Templates |
| Contracts | Contracts |
| Rejection Reasons | Rejection Reasons |
| Email Rejection Templates | Rejection Templates |

### Structure (matching AutomationsTab)

```
<Tabs defaultValue="offer-letters" className="w-full">
  <TabsList>
    <TabsTrigger value="offer-letters">Offer Letters</TabsTrigger>
    <TabsTrigger value="email-templates">Email Templates</TabsTrigger>
    <TabsTrigger value="contract-templates">Contracts</TabsTrigger>
    <TabsTrigger value="rejection-reasons">Rejection Reasons</TabsTrigger>
    <TabsTrigger value="rejection-templates">Rejection Templates</TabsTrigger>
  </TabsList>
  <TabsContent value="offer-letters" className="mt-4">
    {/* offer letters content with its own Card + create button */}
  </TabsContent>
  <TabsContent value="email-templates" className="mt-4">
    {/* email templates content */}
  </TabsContent>
  {/* ...etc */}
</Tabs>
```

Each `TabsContent` will contain a `Card` with the relevant table/empty state and create button, keeping the existing content and logic intact -- just restructured into proper tab panels.

### Files to modify
- `src/components/settings/OfferTemplatesManager.tsx` -- the only file that needs changes
