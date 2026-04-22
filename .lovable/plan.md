

## Public job posting + application form polish (revised — keep brand signature)

A polish, not a makeover. We **keep our pill tab style**, brand colors, and overall component identity. We only adjust spacing, sizes, density, and remove the two elements that read as "AI-generated" on the public-facing page.

### File: `src/pages/PublicJobPosting.tsx`

#### 1. Tighten the content column
- Main wrapper: `max-w-5xl` → `max-w-4xl` (~896px).
- Application tab: drop the 3-column grid; render the form in a single centered column `max-w-2xl mx-auto` (~672px).
- Overview tab: keep the 2-column split, increase gap from `gap-8` to `gap-12`, sidebar pinned at ~280px sticky.

#### 2. Title block + meta
- Wrap H1 area in `pt-12 pb-8`.
- H1: `text-3xl font-semibold` → `text-3xl sm:text-[40px] leading-[1.15] font-semibold tracking-tight`.
- Add a single inline meta line under H1 (location · employment type · department) as `text-sm text-text-secondary`.
- Gap H1 → tabs: `mt-4` → `mt-8`.

#### 3. Tabs — KEEP our signature pill style
No changes to `<TabsList>` / `<TabsTrigger>` styling. Our rounded-xl Poppins lilac active tab stays exactly as-is — it's a brand signature across the app.

#### 4. Application form — remove only the two "AI-generated" tells
- **Resume dropzone**: add `variant?: 'default' | 'minimal'` to `EnhancedResumeDropzone`. Public form passes `variant="minimal"`: plain dashed border, no purple gradient, no Sparkles icon, no "watch some magic!" copy. Replace with a neutral dropzone + "Upload File" button + "or drag and drop" helper. **In-app dashboard usage stays unchanged** (default variant keeps the magic).
- **Application Limits Alert**: demote from a colored alert card to a one-line `text-xs text-text-secondary` note under the form title. Keep the info, lose the visual weight.
- Keep the `<Card>` wrapper around the form (it's our standard surface treatment) but remove the redundant `Application Form` `CardTitle` since the tab already says it.

#### 5. Field, label, spacing spec

| Element | Current | Target |
|---|---|---|
| Label → input gap | `mt-1` | `mt-2` |
| Field-to-field gap | `space-y-4` | `space-y-6` |
| Section-to-section gap | `space-y-8` | `space-y-12` |
| Input height | ~40px | `h-11` (44px — matches our app standard, not 48px) |
| Input font size | `text-sm` | `text-[15px]` |
| Input radius | unchanged (`rounded-lg` from our `Input` component) | unchanged |
| Label | `text-sm font-medium` | `text-[13px] font-semibold text-text-primary` |
| Required indicator | `<Badge>Required</Badge>` chip | red `*` after label (`<span className="text-destructive ml-1">*</span>`) |
| Submit button | default | `h-11 px-8 text-base font-semibold w-full sm:w-auto` |

Note: `h-11` (44px) matches our existing app-wide input standard from the core memory rule — we don't push to 48px just for this page.

#### 6. Custom fields
- On the public page, force all custom fields to full width (drop the `md:grid-cols-4` + `column_span` math). Stack them in the same `space-y-6` rhythm as core fields.
- Column-span layout stays in the in-app builder preview, untouched.

#### 7. Header polish
- Header padding `py-2` → `py-3`; logo `h-6` → `h-7`.
- "Back to Careers Page" button: `variant="ghost"` with icon → plain text link `text-sm text-text-secondary hover:text-text-primary` with just the arrow.

### Files touched
- `src/pages/PublicJobPosting.tsx` — widths, H1 + meta, form spacing/sizing, label red `*`, demote Alert, header polish, single-column form
- `src/components/candidates/EnhancedResumeDropzone.tsx` — add `variant?: 'default' | 'minimal'` prop; minimal = plain dashed dropzone, no gradient/sparkles/magic copy. Default unchanged.

### Out of scope
- Tabs styling (kept as brand signature).
- Card surface treatment (kept).
- Brand colors / Poppins typography (kept).
- In-app dashboard dropzone (kept with full magic treatment).
- Careers index page and tenant logo/brand customization (separate pass).

### Verification (1280–1440px desktop)
1. Title reads as a hero (~40px) with breathing room before tabs; meta line under H1.
2. Tabs look identical to today (lilac pill, Poppins).
3. Application form sits in a centered ~672px column; fields 44px tall, 24px between, red `*` instead of "Required" chip.
4. Resume upload on the public page is a plain dashed rectangle with neutral upload button — no gradient, no sparkles. In-app dashboard upload still has the full magic treatment.
5. "Application Limits" is a small helper line, not a colored card.

