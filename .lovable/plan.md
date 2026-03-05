

# Widen Job Detail Page Content

## Problem

The Job Detail page uses Tailwind's built-in `container` class (max-width: 1280px at large screens), while other pages (Jobs, Pipeline, Candidates, Dashboard) use the app's `Section`/`AppContainer` system with `layout-container` (max-width: 1500px). This makes the job detail page noticeably narrower.

Additionally, the floating sidebar (`JobDetailFloatingSidebar`) uses `w-40` (160px) with `p-4` padding, which pushes the content inward more than necessary.

## Changes

**`src/pages/JobDetail.tsx`**:
1. Replace `container mx-auto ... px-4 sm:px-6 lg:px-8` on the main wrapper (line 843) with the `layout-container` class (or wrap in `AppContainer`) to match other pages' max-width of 1500px.
2. Same change for the loading skeleton wrapper (line 830).

**`src/components/jobs/JobDetailFloatingSidebar.tsx`**:
3. Reduce the sidebar outer width from `w-40` (160px) to `w-20` or similar, and reduce padding from `p-4` to `p-2`, so the floating pill sits closer to the left edge and gives more room to the content area.

These two changes together will make the job detail content align with other pages' widths.

