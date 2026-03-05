

# Redesign Configured Approval Chain — Polished Visual Timeline

## Problem

The current "Configured approval order" section in the empty state is visually flat — plain muted circles with step numbers, no color, no personality. It doesn't match the visual richness of the rest of the app (activity feed, branded empty states, etc.).

## Design

Redesign the configured approvers section to feel polished and on-brand, taking cues from the activity feed timeline and Virgilio's visual identity:

**Visual upgrades:**
- **Colored step icons**: Each step gets a `h-8 w-8` circle with a subtle purple gradient background (`bg-virgilio-purple/10`) and a `User` icon inside (white or purple), similar to how the activity feed uses colored circles with white icons
- **Dashed connector line**: Use a dashed vertical line (`border-dashed`) instead of a solid one — conveys "not yet started" while still being visually interesting
- **Richer text hierarchy**: Approver name in `text-sm font-medium text-text-primary` (not muted), role badge with a soft purple tint (`bg-virgilio-purple/10 text-virgilio-purple`), and step label like "Will review 1st" / "Will review 2nd" in muted text
- **Subtle container**: Wrap the whole chain in a `bg-surface-secondary rounded-xl border border-border p-5` card-within-a-card to give it visual weight and separation from the empty state message
- **Section header**: "Approval chain" with a small `ShieldCheck` icon, styled with `text-sm font-semibold` — not uppercase micro-text

**Layout per step:**
```text
┌─ bg-surface-secondary rounded-xl ────────────────┐
│  🛡 Approval chain                                │
│                                                    │
│  ● John Smith          [Hiring Manager]           │
│  ┆  Will review 1st                               │
│  ● Jane Doe            [Admin]                    │
│  ┆  Will review 2nd                               │
│  ● Bob Wilson          [Recruiter]                │
│     Will review 3rd                               │
│  (purple-tinted icons, dashed connectors)         │
└───────────────────────────────────────────────────┘
```

## Changes

### `src/components/candidates/CandidateOfferApprovals.tsx`

- Import `User` and `ShieldCheck` from lucide-react
- Replace the current plain configured-steps block (lines 67–108) with the redesigned version:
  - Outer container: `bg-surface-secondary/50 rounded-xl border border-border/60 p-5`
  - Header row with `ShieldCheck` icon + "Approval chain" label
  - Each step: `h-8 w-8` circle with `bg-virgilio-purple/12` and `User` icon in `text-virgilio-purple`, dashed vertical connector, name in normal weight, role in a tinted badge, ordinal subtitle ("Will review 1st", "2nd", "3rd")
  - Dashed connector line between steps using `border-l border-dashed border-virgilio-purple/20`

Single file change.

