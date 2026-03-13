

# Rejection Settings: Reorder Toggle + Email Preview

## Changes — `RejectionConfigPanel` in `ApplicationReviewSheet.tsx`

### 1. Reorder elements
Current order: Rejection Reason → Email Template → Notes → Send Email toggle

New order: **Rejection Reason → Send Email toggle → Email Template (if on) → Email Preview (if on + template selected) → Notes**

### 2. Email preview
When `sendEmail` is on and a template is selected, render a preview card below the template dropdown showing:
- **Subject** line (rendered from `template.subject`)
- **Body** (rendered via `SafeHtml` from `template.body`)
- Styled as a compact bordered preview area with `bg-muted/30`, max-height with scroll

The template object is already available from the `templates` array — just find by `config.rejectionEmailTemplateId`.

### 3. Conditional visibility
- Email Template dropdown and preview only render when `sendEmail` is `true`
- Preview only renders when a template is also selected

Single file edit, ~30 lines changed in the `RejectionConfigPanel` function.

