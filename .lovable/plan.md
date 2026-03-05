

# Add Yellow "Offer Document Generated" Banner

## What
Add a clickable yellow banner below the "This offer has been approved" banner that shows the generated offer PDF filename. Clicking it opens the PDF in a new tab.

## Changes

### `src/components/candidates/CandidateOfferDetails.tsx`

1. **Expand `checkOfferDocument`** to also store the attachment metadata (file name, file path) instead of just a boolean. Change state from `hasOfferDocument: boolean` to `offerDocument: { id: string; file_name: string; file_path: string } | null`.

2. **Add yellow banner** right after the approved banner (inside the `mx-6 mt-6 space-y-3` wrapper), visible when `offerDocument` is not null. Uses the project's `pastel-yellow` color tokens:
   - `bg-pastel-yellow/30 border border-pastel-yellow` background/border (matching the pastel pattern from the style guide)
   - `FileText` icon in `text-pastel-yellow-foreground`
   - Clickable — on click, fetch a signed URL from Supabase storage for the file path and open it via `window.open(url, '_blank')`
   - Cursor pointer, hover state for interactivity
   - Text: "Offer document generated" with the file name as subtext

3. **Update references** — replace `hasOfferDocument` checks with `!!offerDocument` for the "Send Offer" button visibility.

### No other files changed.

