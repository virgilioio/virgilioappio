

# Add Virgilio Rejected Red to Style Guide + Update Destructive Color

## Changes

### 1. `src/components/settings/styleguide/ColorPalette.tsx` — Add Virgilio Rejected to semantic colors

Add a new entry to the `semanticColors` array:
```
{ name: 'Rejected (Virgilio Red)', variable: '--virgilio-rejected', hsl: '0 100% 63%', hex: '#ff4040', description: 'Candidate rejection and critical destructive states' }
```

### 2. `src/index.css` — Update `--destructive` to Virgilio Rejected red

Change:
- `--destructive: 0 100% 88%` → `--destructive: 0 100% 63%` (matches `--virgilio-rejected`)
- `--destructive-foreground: 0 100% 30%` → `--destructive-foreground: 0 0% 100%` (white text for contrast on vivid red)

This single CSS variable change propagates to **every** component using the `destructive` button variant, `destructive` badge variant, and any `bg-destructive` / `text-destructive` usage — no individual component edits needed.

### 3. `src/components/settings/styleguide/ColorPalette.tsx` — Update destructive swatch metadata

Update the existing Destructive entry to reflect the new values:
- hsl: `'0 100% 63%'`, hex: `'#ff4040'`
- Update Destructive Foreground hsl to `'0 0% 100%'`

### Files to change

| File | Change |
|------|--------|
| `src/index.css` | Lines 37-38: Update `--destructive` and `--destructive-foreground` HSL values |
| `src/components/settings/styleguide/ColorPalette.tsx` | Add Virgilio Rejected swatch + update Destructive swatch metadata |

Two files, four line edits. Every destructive button, badge, and banner across the app inherits the new vivid red automatically via the CSS variable.

