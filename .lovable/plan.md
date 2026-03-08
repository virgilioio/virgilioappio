

# Fix: "Objects are not valid as a React child" in MetricCard

## Root Cause

The `isLucideIcon` check in `src/components/ui/metric-card.tsx` line 29 uses `typeof icon === 'function'`, but Lucide React icons (v0.462+) are `forwardRef` objects — they have `$$typeof` and `render` keys, not a plain function signature. When the check fails, the icon object falls through to the else branch on line 97 where it's rendered as `{icon}` inside a div — React can't render a raw component object as a child.

## Fix

**File:** `src/components/ui/metric-card.tsx`, line 28–30

Change:
```ts
function isLucideIcon(icon: any): icon is LucideIcon {
  return typeof icon === 'function'
}
```

To:
```ts
function isLucideIcon(icon: any): icon is LucideIcon {
  return typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in icon && 'render' in icon)
}
```

This handles both classic function components and `forwardRef` objects. One line change, no other files affected.

