

# Fit Carousel Images by Width

**File:** `IntegrationDetailDialog.tsx`, line 49

Change the image class from `object-cover` to `object-contain` so images fit fully by width instead of being cropped to fill height.

```tsx
// Before
className="w-full h-full object-cover rounded-xl"

// After
className="w-full h-full object-contain rounded-xl"
```

