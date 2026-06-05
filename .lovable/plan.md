# Fix public job posting & application page

All changes are scoped to `src/pages/PublicJobPosting.tsx` (+ a tiny prop on `JobBodySection` / `JobBulletList` for brand color).

## 1. Job description renders as raw markdown

The posting description is stored as markdown (`## **Title**`, `•` bullets, etc.) but is currently passed straight to `<SafeHtml>`, which only sanitizes HTML — it does not parse markdown. Result: the user sees literal `## **Supervisor de Almacén**` text.

**Fix:** convert markdown → HTML before passing to `SafeHtml`. The project already has `markdownToHtml` (`@/utils/markdown`, already imported in this file). Wrap both the role description and the tenant "About" block:

```tsx
<SafeHtml content={markdownToHtml(posting.description)} className="prose ..." />
<SafeHtml content={markdownToHtml(tenantAbout)} className="prose ..." />
```

## 2. "About <company>" appears after the role description

Currently the overview body renders, in order: About the role → Responsibilities → Qualifications → Nice to have → Benefits → Process → About <company>. The expectation is **About <company> first**, then the role content.

**Fix:** move the `{tenantAbout && (...)}` block from after the process list to **before** the "About the role" `JobBodySection` (still inside the `lg:col-span-7` column, above all other sections, with the EEO statement remaining at the bottom).

## 3. Selected brand color isn't applied

`brand_color` is saved per posting on `job_postings.details.brand_color` (set by the wizard's `PostingBrandingCard`). The public page reads `details` but never uses it. All purple accents on the public page are currently hardcoded `#6F3FF5` (bullets in `JobBulletList`, etc.).

**Fix:**
- Read `brandColor = posting.details?.brand_color || '#6F3FF5'` in `PublicJobPosting`.
- Pass it down as an optional `accentColor` prop to `JobBulletList` (use it for the bullet dot color) and to `JobProcessList` (step number/badge color).
- Apply it inline to the existing purple touchpoints in `JobHeader` props: the department chip background, the "Apply for this role" CTA hover, and the small bullet/dot accents. Since `JobHeader` currently hardcodes `#EDE4FF` / `#5b2bd1` / `#0d0d09`, only override the **accent** elements (department chip + the meta-chip icons), leaving the dark CTA button as-is (per existing design). Threaded via a new optional `accentColor` prop on `JobHeader`.
- Also set the inline accent on the `Reply in < 48 hours` clock-icon bubble in `JobAsideReplyCard` via a new optional `accentColor` prop.

No design tokens are changed — the fallback remains `#6F3FF5` so existing postings without a configured color look identical.

## 4. Application form is broken / edge-to-edge

In the `Application` tab the form content sits directly inside `<TabsContent value="application">` with `grid grid-cols-1 lg:grid-cols-3 gap-12` — there's **no container** wrapping it, so labels and inputs hit the viewport edge (visible in the screenshot: "Resume/CV", "Full Name", "Submit Application" all flush to x=0, and the footer is full-width too).

The Overview tab does have a wrapper: `<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid ...">`.

**Fix:** wrap the Application tab's grid in the same container so it matches the Overview layout:

```tsx
<TabsContent value="application">
  <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-12">
    ...existing form + aside...
  </div>
</TabsContent>
```

This single change pulls every field, the section header, the Job Details aside, and the Submit button into the proper centered column with consistent gutters.

## Out of scope

- No edits to `EnhancedResumeDropzone`, form submission logic, hooks, or the database schema.
- No new design tokens. Brand color is applied inline only where the page already uses purple.
- No changes to the dark `Apply for this role` button (kept ink-black per current design).
