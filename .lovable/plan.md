

# Add Country Flag Avatars to Geography Insights

## Overview

Add circular flag avatars next to each country name in the "Top Countries" list on the Talent Intelligence Geography section. Use emoji flags derived from ISO country codes (already available in `COUNTRIES` constant as 2-letter codes like `US`, `DE`, etc.).

## Changes

### `src/components/talent-intelligence/GeographyInsights.tsx`

**Add a helper function** to convert ISO 2-letter country code to emoji flag:
```ts
function countryCodeToFlag(code: string): string {
  return code.toUpperCase().replace(/./g, char =>
    String.fromCodePoint(127397 + char.charCodeAt(0))
  )
}
```

**Add a helper** to resolve the ISO code from the country name (which may be a label like "United States" or a code like "US"):
```ts
function getCountryCode(name: string): string | null {
  const country = COUNTRIES.find(c => c.value === name || c.label === name)
  return country?.value ?? null
}
```

**Add a `CountryFlag` component** — circular avatar showing the emoji flag, with a muted fallback circle if code is unknown:
```tsx
function CountryFlag({ name }: { name: string }) {
  const code = getCountryCode(name)
  if (!code) return <div className="w-6 h-6 rounded-full bg-muted" />
  return (
    <div className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center text-sm leading-none">
      {countryCodeToFlag(code)}
    </div>
  )
}
```

**Update the Top Countries list** (line 141-142) to add the flag before the country name:
```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <CountryFlag name={country.name} />
    <span className="text-sm font-poppins text-foreground">{displayName(country.name)}</span>
  </div>
  <span className="text-xs font-poppins font-semibold text-muted-foreground">{country.count} ({pct}%)</span>
</div>
```

| File | Change |
|------|--------|
| `src/components/talent-intelligence/GeographyInsights.tsx` | Add flag avatar helpers + render flags in Top Countries list |

