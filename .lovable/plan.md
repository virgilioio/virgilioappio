

# Fix: Bullet/List Styling Not Rendering Across the App

## Root Cause
Two issues:

1. **`@tailwindcss/typography` plugin is installed but NOT activated** — it's in `package.json` devDependencies but missing from the `plugins` array in `tailwind.config.ts`. This means all `prose` classes are no-ops, so `<ul>` and `<ol>` elements rendered by `SafeHtml` have no list markers, padding, or spacing.

2. **Inconsistent className usage** — Some components (like `JobOverviewTab.tsx`) manually add `[&_ul]:list-disc [&_ul]:pl-6` overrides, while others (like `PublicJobPosting.tsx`) rely solely on `prose` which does nothing without the plugin.

## Fix

### 1. `tailwind.config.ts` — Add typography plugin
Add `require("@tailwindcss/typography")` to the plugins array alongside the existing `tailwindcss-animate`:

```ts
plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
```

This activates `prose` classes globally, giving `<ul>`, `<ol>`, `<li>`, `<p>`, `<h1>`–`<h6>`, `<blockquote>`, etc. proper styling wherever `prose` is used.

### 2. `src/pages/PublicJobPosting.tsx` — Add list styling overrides
Add explicit list styling classes to the job description and tenant about `SafeHtml` components (lines 620 and 634) to match the pattern already used in `JobOverviewTab.tsx`:

```
[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_p]:my-2
```

### 3. `src/pages/PublicCareersPage.tsx` — No changes needed
This page doesn't render job descriptions with `SafeHtml`, only job titles/metadata.

### No other changes needed
The `convertBulletParagraphsToLists` function in the sanitizer is already correctly converting `•` paragraphs to `<ul><li>` — the problem is purely that the generated lists have no CSS styling applied.

