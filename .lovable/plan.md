
# Fix: Login/SignUp "Find your people." Typography

## Changes Required

Update the `<h1>` element in both Login.tsx and SignUp.tsx:

### File: `src/pages/Login.tsx` (line ~73)

| Property | Before | After |
|----------|--------|-------|
| Font weight class | `font-extrabold` | `font-bold` |
| Period color | `#7c3aed` | `#d7c5fb` |

### File: `src/pages/SignUp.tsx` (line ~78)

Same changes as Login.tsx.

---

## Code Change

**Before:**
```tsx
<h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-2" style={{ fontFamily: 'Poppins', letterSpacing: '-0.06em' }}>
  Find your people<span style={{ color: '#7c3aed' }}>.</span>
</h1>
```

**After:**
```tsx
<h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-2" style={{ fontFamily: 'Poppins', letterSpacing: '-0.06em' }}>
  Find your people<span style={{ color: '#d7c5fb' }}>.</span>
</h1>
```

---

## Final Typography Specs

- **Font**: Poppins
- **Weight**: 700 (bold)
- **Letter spacing**: -0.06em (-6%)
- **Period color**: #d7c5fb (Lilac Frost)
