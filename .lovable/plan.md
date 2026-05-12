## Header gap + scroll-leak handling

### 1. More breathing room from the sidebar

The header currently starts at `left-[4.75rem]` (flush against the sidebar's right edge). Add the same 12px gutter the sidebar uses everywhere else.

- **`Header.tsx`**: `left-[4.75rem]` → `left-[5.5rem]` (adds 12px).
- **`Layout.tsx`**: `sm:pl-[4.75rem]` → `sm:pl-[5.5rem]` so page content stays visually aligned with the header's left edge.

### 2. Scroll-leak behind the floating header — the professional answer

**What you're seeing:** the header floats with a 12px gap above it. The page itself is the scroll container, so as you scroll, content slides upward through that 12px strip before disappearing off the viewport top. This is the trade-off of any floating/inset chrome.

**How it's handled professionally** (three established patterns, in order of how common they are in premium apps):

1. **Backdrop blur header.** Make the floating bar semi-transparent with `backdrop-blur`. Content still passes underneath but is softened into the chrome instead of looking like a leak. Linear, Vercel, Notion.
2. **Frame mat.** Place a solid strip in the page background color at the very top of the viewport (behind the floating header) so scrolling content disappears into the mat, not into thin air. Reads as a deliberate frame. Arc browser, Raycast.
3. **Inner scroll container.** Make `<main>` itself the scroller (`overflow-y-auto`, fixed height) so content physically cannot exist outside the content area. The cleanest result, but more invasive — affects sticky elements and page-scroll restoration across the whole app.

**Proposed approach:** option **2 (frame mat)**, because it preserves the current floating aesthetic, requires zero changes to scroll behavior, and keeps the dark slab fully opaque and crisp (no blur muddiness). One small fixed strip in `bg-background` solves it.

- **`Layout.tsx`**: add a `<div aria-hidden className="hidden sm:block fixed top-0 left-[5.5rem] right-3 h-3 z-40 bg-background pointer-events-none" />` immediately before `<Header />`. This fills only the 12px gap above the header, behind everything else, so scrolling content tucks under it cleanly.

### Out of scope

- Sidebar position (left edge unchanged).
- Mobile chrome (already hidden under `sm:`).
- Switching to inner-scroll architecture (option 3) — not needed unless you want the fix global.