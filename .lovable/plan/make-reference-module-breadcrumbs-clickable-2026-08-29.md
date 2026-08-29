# Make reference-module breadcrumbs clickable

## Problem
In **Reference checks → Templates → Template editor**, the breadcrumb trail (`Reference checks / Templates / <template name>`) renders as plain text. To go back, the user must use the header navigation. The `PageHeader` component only accepts `breadcrumb?: string[]` and renders every crumb as a non-interactive `<span>`.

Jobs and in-job candidate profiles handle "back" differently (back buttons), so there's no existing clickable-breadcrumb pattern to copy — this introduces one into `PageHeader` itself, which is the shared component.

## Scope
Only `PageHeader`'s breadcrumb and its single consumer (`TemplateEditor.tsx`). No routing, data, or permission changes.

## Plan

1. **`src/components/layout/PageHeader.tsx`**
   - Widen the prop: `breadcrumb?: (string | { label: string; to: string })[]`.
   - Plain strings render exactly as today (span).
   - Items with `to` render as react-router `<Link>`: same 11.5px Inter `#8B8F9E` styling, with `cursor: pointer` and a hover state (`color: #1F2230`, subtle underline on hover), matching the calm interaction philosophy — no bold color shifts.
   - The last crumb always stays a non-clickable span (it's the current page), even if passed with a `to`.

2. **`src/components/references/templates/TemplateEditor.tsx`**
   - Update the breadcrumb to:
     ```ts
     breadcrumb={[
       { label: 'Reference checks', to: '/references' },
       { label: 'Templates', to: '/references/templates' },
       draft.name || 'Untitled template',
     ]}
     ```

3. **Verify**
   - Open a template in the editor in the preview, click "Templates" → lands on `/references/templates`; click "Reference checks" → lands on `/references`.
   - Confirm the current-page crumb is not a link and styling is unchanged otherwise.

## Out of scope
- Adding breadcrumbs to pages that don't have them (Requests list, Templates list) — they don't render a breadcrumb today.
- Changing jobs/candidate-profile navigation.
