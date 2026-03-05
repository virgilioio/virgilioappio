

# Simplify Approval Chain — Clean Vertical Timeline

Inspired by the reference image: large circles on a solid vertical line, bold step names, subtle subtitle underneath. No background cards, no borders, no icon clutter.

## Changes — `CandidateOfferApprovals.tsx`

Replace lines 67–109 (the `hasConfiguredChain` block):

**Remove:**
- Gray background, border, padding wrapper
- `ShieldCheck` icon from header
- `User` icons from circles
- Dashed connectors

**New structure:**
- Simple "Steps" label: `text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4`
- Solid vertical line running through all steps: `absolute left-[15px] top-0 bottom-0 w-0.5 bg-border`
- Each step: `h-[30px] w-[30px]` hollow circle (`border-2 border-border bg-surface-primary rounded-full`) sitting on the line
- Approver name: `text-sm font-semibold text-text-primary` — bold and prominent like in the reference
- Subtitle: role badge as plain text with a small icon — `text-xs text-muted-foreground` with "Approval" or the role label
- Generous vertical spacing (`pb-7`) between steps
- No status badges on the right for now (these are pre-request, all pending)

This mirrors the reference: circles on a line, name bold, type underneath, clean and minimal.

