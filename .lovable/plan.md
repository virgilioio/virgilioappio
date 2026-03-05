

# Add Pastel Colors to Approval Step Numbers

## Changes — `CandidateOfferApprovals.tsx`

Use the existing pastel color palette to color each step's numbered circle. Each step gets a different pastel background with matching text, cycling through the 6 pastel colors.

**Color mapping array:**
```ts
const stepColors = [
  { bg: 'bg-pastel-blue', text: 'text-blue-600' },
  { bg: 'bg-pastel-purple', text: 'text-purple-600' },
  { bg: 'bg-pastel-green', text: 'text-green-600' },
  { bg: 'bg-pastel-pink', text: 'text-pink-600' },
  { bg: 'bg-pastel-yellow', text: 'text-yellow-600' },
  { bg: 'bg-pastel-orange', text: 'text-orange-600' },
]
```

**Per step circle** (line 75): Replace `border-2 border-border bg-surface-primary` with `${stepColors[index % 6].bg}` (no border). Replace the number's `text-muted-foreground` with the matching text color.

Apply to **both** the inactive configured chain (lines 74–77) and the active approval request timeline. The `opacity-50` wrapper on the inactive chain already handles graying everything out automatically.

Single file, ~10 lines changed.

