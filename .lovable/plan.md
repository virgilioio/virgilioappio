
# Fix: Mobile Clipboard Error for Stage-Specific Booking Links

## Problem Identified

The booking link copy functions in `useStageBookingInterviewers.ts` and `useContextualBookingLink.ts` directly use `navigator.clipboard.writeText()` without a fallback. On mobile browsers (especially in-app browsers like those from social media apps), the Clipboard API may be restricted or unavailable, causing the copy operation to fail silently and show an error toast.

The project already has a `copyToClipboard` utility in `src/utils/clipboard.ts` that includes a fallback mechanism using the legacy `document.execCommand('copy')` method, but it's not being used in these hooks.

---

## Solution

Replace direct `navigator.clipboard.writeText()` calls with a reusable helper function that includes proper fallback support for mobile browsers.

---

## Files to Modify

### 1. `src/utils/clipboard.ts`

Add an async version that returns success/failure status (for use in hooks that need to control their own toast messages):

```typescript
// Add this new function
export const copyToClipboardSilent = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for mobile/restricted browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (fallbackErr) {
      return false;
    }
  }
};
```

### 2. `src/hooks/useStageBookingInterviewers.ts`

**Line 197** - Replace:
```typescript
await navigator.clipboard.writeText(link);
```

With:
```typescript
import { copyToClipboardSilent } from '@/utils/clipboard';
// ...
const success = await copyToClipboardSilent(link);
if (!success) throw new Error('Clipboard copy failed');
```

### 3. `src/hooks/useContextualBookingLink.ts`

**Line 216** - Replace:
```typescript
await navigator.clipboard.writeText(contextualLink);
```

With:
```typescript
import { copyToClipboardSilent } from '@/utils/clipboard';
// ...
const success = await copyToClipboardSilent(contextualLink);
if (!success) throw new Error('Clipboard copy failed');
```

---

## Technical Notes

- The fallback uses `document.execCommand('copy')` which is deprecated but has wider mobile browser support
- The textarea is positioned off-screen to avoid visual flicker
- Both hooks already have try/catch blocks that will show appropriate error toasts if the fallback also fails
- This approach maintains the existing toast behavior in each hook while adding mobile compatibility
