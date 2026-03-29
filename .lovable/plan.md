

# Generate GoGio Visual Design Guidelines (Markdown)

## What

Export a comprehensive Markdown document (`/mnt/documents/gogio-visual-guidelines.md`) containing every exact design token, component spec, and pattern extracted from the live codebase — ready to hand to the website team.

## Document structure

1. **Color System** — Every HSL value + hex for: brand, semantic, surface, text hierarchy, pastel, virgilio-specific, dark mode overrides
2. **Typography** — Font families (Poppins headings, Inter body), full size scale (xs through 4xl with px values), line heights, letter spacing, heading hierarchy
3. **Shadows & Elevation** — All 9 shadow tokens (xs through 2xl, button, card, elevated) with exact rgba values
4. **Spacing & Layout** — Spacing scale (xs–6xl), layout gutters/padding, border-radius tokens, max-widths
5. **Buttons** — All 10 variants (default, secondary, outline, ghost, link, destructive, success, warning, info, virgilio) with exact bg/text/hover/active classes; 4 sizes with heights; loading/disabled states
6. **Form Elements** — Input (h-11, rounded-lg, border-virgilio-border, focus ring virgilio-purple, error/success states, hover lift), Textarea (same pattern, min-h-96px), Select (h-32px, border-border, hover accent/60), Checkbox (4x4, rounded-sm, checked=primary), Switch (h-6 w-11, checked=#7e3eff, unchecked=#e5e7eb)
7. **Tabs** — Container (rounded-xl, p-1.5, bg-#fffcf9, border virgilio-border/20), trigger (rounded-lg, px-4 py-2.5, font-poppins, active bg=#d7c5fb text=#0d0d09 font-semibold)
8. **Cards** — Standard (rounded-lg, bg-surface-primary, border-virgilio-border, shadow-calendly), hover/interactive variants, CardTitle with lilac period
9. **Badges** — Base shape (rounded-full, px-2 py-0.5, text-xs font-medium), all ~40 semantic variants with exact border/bg/text color specs per category (roles, seats, status, pipeline, booking, integration, match tiers, activities)
10. **Metric Cards / Pulse Cards** — 3 variants (default, hero, inline), icon circle (rounded-full bg-background shadow-md), semantic icon colors, trend badges, sparkline slots, rounded-2xl wrapper with shadow-md hover:shadow-xl
11. **AI Banners** — Structure (rounded-lg bg-pastel-purple/30 border-pastel-purple/50), icon (gio-ai-banner-icon h-10 standard, h-8 compact), title (text-sm font-semibold text-foreground), subtext (text-xs text-muted-foreground), optional copy/dismiss buttons
12. **Skeletons** — Base (animate-pulse rounded-lg bg-virgilio-border/30), pre-built patterns (TableSkeleton, CardSkeleton, ListRowSkeleton with exact dimensions)
13. **Charts** — Area (linear gradients top-to-bottom opacity, no grid), Donut (center stats, colored-dot legends), Funnel (horizontal rounded-xl bars, chevron conversions), tooltip style (rounded-2xl shadow Poppins), highlight glow on key stages
14. **Animations & Transitions** — Timing tokens (fast 150ms, default 200ms, slow 300ms), hover effects (lift -translate-y-0.5, scale-105), active (scale-95), AI border gradient animation

## Execution

Run a script that writes all gathered specs into a structured Markdown file at `/mnt/documents/gogio-visual-guidelines.md`.

## Files changed

None — this is a document generation task, no codebase modifications.

