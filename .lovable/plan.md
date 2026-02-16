

## Fix: Delete Button Sizing in Field Editor

### Problem
The delete (Trash) button in the custom application form field editor uses `size="icon"` with a manual `className="h-8 w-8"` override. This conflicts with the design system's `icon` size variant, which sets `h-button w-button` plus mobile-friendly minimums (`min-h-[40px] min-w-[40px]`). The forced `h-8 w-8` (32px) can make the button appear as a thin line, especially on certain viewports.

### Solution
Align the delete button with the Edit button's pattern: use `size="sm"` and add a text label "Delete" so it matches the style guide and is consistently tappable.

### Technical Change

**File: `src/components/jobs/postings/FieldEditor.tsx` (lines 395-403)**

Change the delete button from:
```tsx
<Button variant="outline" size="icon" onClick={...} title="Delete field" className="h-8 w-8">
  <Trash2 className="h-4 w-4" />
</Button>
```

To:
```tsx
<Button variant="outline" size="sm" onClick={...} title="Delete field" className="h-8">
  <Trash2 className="h-3 w-3 mr-1" />
  Delete
</Button>
```

This matches the adjacent Edit button's pattern exactly (`variant="outline"`, `size="sm"`, `className="h-8"`, icon + label), ensuring consistent sizing and proper touch targets on mobile.

Also apply the same fix to the option-remove button at line 211 (`h-8 w-8` icon button for removing select options), changing it to match:
```tsx
<Button variant="ghost" size="sm" onClick={...} className="shrink-0 h-8">
  <Trash2 className="h-3 w-3" />
</Button>
```

### Files Modified
| File | Change |
|---|---|
| `src/components/jobs/postings/FieldEditor.tsx` | Update delete button from `size="icon"` to `size="sm"` with label, matching Edit button pattern |

