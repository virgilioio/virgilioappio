

# Separate Location Sub-Fields on One Line

## Current State
- **`ApplicationFieldsRenderer.tsx`** (line 320): Already renders separate City/State/Country inputs using `grid grid-cols-1 md:grid-cols-3` — so on mobile they stack, on md+ they're on one line. **This is already correct.**
- **`PublicJobPosting.tsx`** (line 894): Same pattern — `grid grid-cols-1 md:grid-cols-3`. **Already correct.**
- **`OfferComposerBody.tsx`**: Has NO location case — falls to the default single `Input`. **Needs fixing.**

## What Needs to Change

### 1. `src/components/candidates/OfferComposerBody.tsx` — Add location case to `renderFieldInput`

Add a `case 'location':` block that:
- Reads `field.field_config` to get which sub-fields are enabled (city/state/country)
- Parses the value as JSON `{ city, state, country }`
- Renders separate inputs for each enabled sub-field in a single-row grid
- Uses dynamic grid columns based on number of enabled fields (e.g., `grid-cols-2` if only 2 fields, `grid-cols-3` if all 3)
- Shows MapPin icon in the label

### 2. Make grid columns dynamic everywhere

When only 1 or 2 sub-fields are checked, `grid-cols-3` wastes space. Update all three renderers to use dynamic column count:

**`ApplicationFieldsRenderer.tsx`** (line 320): Change from hardcoded `md:grid-cols-3` to `md:grid-cols-{locationFields.length}` (using a className map).

**`PublicJobPosting.tsx`** (line 894): Same change — dynamic columns based on `locationSubFields.length`.

**`OfferComposerBody.tsx`**: New code will use dynamic columns from the start.

Column class map:
```ts
const colsClass = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' }[fieldCount] || 'md:grid-cols-3'
```

### 3. Also add salary case to `OfferComposerBody.tsx`

While we're here, the salary field type also falls to the default Input. Add a `case 'salary':` that renders the salary amount input with currency badge and period badge (matching the pattern in `ApplicationFieldsRenderer` and `PublicJobPosting`).

## Summary of File Changes
- **`src/components/candidates/OfferComposerBody.tsx`** — Add `location` and `salary` cases to `renderFieldInput`
- **`src/components/forms/ApplicationFieldsRenderer.tsx`** — Dynamic grid cols for location
- **`src/pages/PublicJobPosting.tsx`** — Dynamic grid cols for location

