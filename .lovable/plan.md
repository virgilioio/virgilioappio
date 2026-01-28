
# Update Login/SignUp Page Styling

## Changes Overview

Update both authentication pages to:
1. Change background color from `#d7c5fb` (Lilac Frost) to `#fffcf9` (Warm Off-White)
2. Remove the left-side graphic section entirely

---

## Files to Modify

### 1. `src/pages/Login.tsx`

**Remove:**
- The left side div containing the `authGraphic` image (lines 63-70)
- The `authGraphic` import at the top

**Update:**
- Change background color from `#d7c5fb` to `#fffcf9`
- Update layout from split (50/50) to centered single column
- Change right side from `lg:w-1/2` to full width centered

### 2. `src/pages/SignUp.tsx`

**Remove:**
- The left side div containing the `authGraphic` image (lines 68-75)
- The `authGraphic` import at the top

**Update:**
- Change background color from `#d7c5fb` to `#fffcf9`
- Update layout from split (50/50) to centered single column
- Change right side from `lg:w-1/2` to full width centered

---

## Visual Result

| Before | After |
|--------|-------|
| Split layout (50/50) | Centered single column |
| Left: Image on purple | No left section |
| Right: Form on purple | Full-width centered form |
| Background: `#d7c5fb` | Background: `#fffcf9` |

---

## Code Changes Preview

**Login.tsx structure after changes:**
```tsx
<div className="min-h-screen flex flex-col" style={{ backgroundColor: '#fffcf9' }}>
  {/* Centered content - no more split layout */}
  <div className="w-full flex flex-col justify-center items-center px-6 min-h-screen">
    {/* Logo and tagline */}
    {/* Form card */}
    {/* Footer */}
  </div>
</div>
```

Same pattern for SignUp.tsx.
