

# Show Approval Restart Icons Always + Add Tooltip

## Problem
The `RefreshCcw` icon on fields that trigger approval restart only appears when the offer is in `pending_approval` status. The user wants these icons always visible when editing, with a hover tooltip explaining the behavior.

## Change — `src/components/candidates/OfferComposerBody.tsx`

1. **Remove the `currentOffer?.status === 'pending_approval'` condition** from line 401 — show the icon whenever `field.triggers_approval_restart` is true
2. **Wrap the icon+text in a `Tooltip`** so hovering shows "Editing this field will restart the approval process"
3. **Simplify the inline label** to just the icon (no text), keeping it clean — the tooltip provides the explanation
4. Import `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` from `@/components/ui/tooltip`

### Result (lines 401-406)
```tsx
{field.triggers_approval_restart && (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center text-amber-600 dark:text-amber-400 cursor-help">
          <RefreshCcw className="h-3 w-3" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>Editing this field will restart the approval process</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

Also remove the now-unused condition check on `currentOffer?.status === 'pending_approval'` from the label (keep it in the save handler where it's still needed).

