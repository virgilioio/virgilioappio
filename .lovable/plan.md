

# Clear Draft on Cancel

## Problem
When the user clicks "Cancel" in the offer composer, `handleClose` is called, which **saves** the draft to localStorage before closing. The user expects canceling to discard their work.

## Fix

**File: `src/components/candidates/MinimizableOfferComposer.tsx`**

Add a separate `handleCancel` function that clears the draft and resets state (like `handleSuccess` does), and pass that as `onCancel` instead of `handleClose`.

```ts
const handleCancel = () => {
  clearDraft()
  setSelectedFormId('')
  setFieldValues({})
  setDraftRestored(false)
  onOpenChange(false)
  setIsMinimized(false)
}
```

Then pass `onCancel={handleCancel}` to `OfferComposerBody` instead of `onCancel={handleClose}`.

The X button in the header bar will still use `handleClose` (which preserves the draft) — so closing via X saves progress, but explicitly canceling discards it.

