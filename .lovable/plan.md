

# Remove "Back to Jobs" Button from Job Detail Page

## Changes

**`src/pages/JobDetail.tsx`**:
1. **Remove the desktop "Back to Jobs" button block** (lines 855-862) — the `<div className="mb-4">` wrapping the `Button` with `ArrowLeft` + "Back to Jobs".
2. **Tighten top padding** on the container (line 843) — reduce `pt-2 sm:pt-3 lg:pt-4` to smaller values (e.g., `pt-1 sm:pt-2 lg:pt-3`) so the job title moves up into the reclaimed space.
3. **Keep the mobile header as-is** — it has its own back arrow in `JobDetailMobileHeader` which is appropriate for mobile navigation.
4. **Keep the error state "Back to Jobs" button** (line 793) — that's a fallback for when the job isn't found, still useful.

Single file, ~10 lines changed.

