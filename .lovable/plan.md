

# Redesign Integration Detail Dialog — Larger, with Carousel + Side Layout

## Findings

- **Rejected banner color**: `#ff4040` (used inline in `RejectionStatusBanner.tsx`, line 23). This is NOT in the CSS variables/style guide yet — needs to be added.
- **Current dialog**: Small (`sm:max-w-md`), vertical layout with header + description + buttons stacked.
- **Integration registry**: Each entry has `id`, `name`, `description`, `category`, `logo`, `DetailComponent`. No `images` field yet.

## Plan

### 1. Add `--virgilio-rejected` CSS variable to style guide

In `src/index.css`, add to both `:root` and `.dark`:
```
--virgilio-rejected: 0 100% 63%;  /* #ff4040 */
```
Also update `RejectionStatusBanner.tsx` to use this variable instead of the inline `#ff4040`.

### 2. Add `images` field to integration registry

Update `IntegrationDefinition` in `integrationRegistry.ts` to include an optional `images?: string[]` array. Update `IntegrationEntry` in `IntegrationsTab.tsx` similarly.

For WhatsApp, copy the uploaded image to `src/assets/integrations/whatsapp-hero.png` and reference it. Other integrations can have empty arrays for now.

### 3. Redesign `IntegrationDetailDialog.tsx` — Large two-column layout

- **Size**: `sm:max-w-3xl` (much wider)
- **Layout**: Two-column — left side has image carousel, right side has description + action buttons
- **Header** (full width, top): Keep the existing icon + title + category badge + status badge row
- **Left column (~60%)**: Image carousel with dots navigation. If no images, show a centered logo placeholder
- **Right column (~40%)**: 
  - Description text
  - Action buttons stacked vertically at bottom:
    - **Install**: `variant="virgilio"` (Virgilio Purple `#6F3FF5`)
    - **Uninstall**: Custom style using `--virgilio-rejected` (`#ff4040`) — solid bg with white text
    - **Configure**: Outlined Virgilio Purple — `variant="outline"` with explicit purple border/text classes

### 4. Simple image carousel component

Build a minimal carousel inline (or as a small sub-component) within the dialog:
- Array of image URLs
- Current index state, prev/next arrows, dot indicators
- Smooth CSS transition between images

### 5. Pass images through from IntegrationsTab

Update the `INTEGRATIONS` array to include `images` for WhatsApp. Pass `images` prop to `IntegrationDetailDialog`.

## Button Styling Summary

| Button | Style |
|--------|-------|
| Install | `bg-[hsl(267,89%,60%)] text-white` (Virgilio Purple) |
| Uninstall | `bg-[hsl(var(--virgilio-rejected))] text-white` (#ff4040) |
| Configure | `border-[hsl(267,89%,60%)] text-[hsl(267,89%,60%)]` outlined |

## Files

| File | Action |
|------|--------|
| `src/assets/integrations/whatsapp-hero.png` | Create (copy uploaded image) |
| `src/index.css` | Edit — add `--virgilio-rejected` variable |
| `src/components/settings/integrationRegistry.ts` | Edit — add `images` to type |
| `src/components/settings/IntegrationDetailDialog.tsx` | Rewrite — large 2-col layout with carousel |
| `src/components/settings/IntegrationsTab.tsx` | Edit — add `images` to entries, pass to dialog |
| `src/components/candidates/RejectionStatusBanner.tsx` | Edit — use CSS var instead of inline `#ff4040` |

