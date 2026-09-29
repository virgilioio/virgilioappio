# Fix: "Tooltip must be used within TooltipProvider" crash on Client view toggle

## Root cause (confirmed)
`src/components/jobs/ClientViewSection.tsx` renders `<Tooltip>` / `<TooltipTrigger>` / `<TooltipContent>` (lines 113–118, the "Not part of the client view" hint on excluded stages) but never wraps them in `<TooltipProvider>`. Radix throws as soon as the section renders, which is why toggling Client view on crashes the page.

## Fix
- In `ClientViewSection.tsx`, import `TooltipProvider` and wrap the component's returned content (or just the tooltip cluster) in `<TooltipProvider>`. One-line structural change, no visual difference.
- Audit the other client-view files added in the same batch (`ClientViewStrip.tsx`, `JobShareMenu.tsx`, `ShareDossierMenu.tsx`, `PublicPipeline.tsx`) for any other unwrapped `Tooltip` usage and wrap those too if found. `PipelineOverview.tsx` already imports and uses `TooltipProvider` correctly.

## Verify
- Typecheck/build clean.
- Confirm no remaining `Tooltip` usages lack a provider in the touched files.
