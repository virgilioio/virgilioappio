

# Fix: Save Button Disabled After Draft Restore

## Root Cause

The `OfferComposerBody` has a `useEffect` that resets `fieldValues` to `{}` whenever `selectedFormId` changes, guarded by `draftRestored`:

```tsx
useEffect(() => {
  if (!draftRestored) {
    onFieldValuesChange({})
  }
}, [selectedFormId])
```

This is fragile. There is a timing/batching edge case where the effect fires before `draftRestored` is `true` in the child's closure, clearing the restored draft values. Once cleared, all required fields become empty and `canSave()` returns `false`.

## Fix

Remove the `useEffect`-based field reset entirely. Instead, handle the reset in the **callback** when the user manually changes the form dropdown. This eliminates the race condition.

### 1. `MinimizableOfferComposer.tsx`

Create a `handleFormChange` callback that resets field values when the user picks a different form, and pass that instead of `setSelectedFormId`:

```tsx
const handleFormChange = (id: string) => {
  setSelectedFormId(id)
  setFieldValues({})
  setDraftRestored(false)
}

// In JSX:
<OfferComposerBody
  onSelectedFormIdChange={handleFormChange}  // was: setSelectedFormId
  ...
/>
```

### 2. `OfferComposerBody.tsx`

Remove the `useEffect` that conditionally resets field values (lines 58-63). The parent now handles the reset via the callback, so this effect is no longer needed.

## Why this is better

- **No race condition**: the reset happens synchronously in the user action handler, not in an async effect
- **No dependency on `draftRestored` flag timing**: draft restore sets `fieldValues` directly and never triggers a reset
- **Simpler code**: removes a fragile `useEffect` with an incomplete dependency array

## Files changed
- `src/components/candidates/MinimizableOfferComposer.tsx` — add `handleFormChange` callback
- `src/components/candidates/OfferComposerBody.tsx` — remove the field-reset `useEffect`

