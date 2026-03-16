

# Use Purple Placeholder Badges in WhatsApp Template Config

## What

Replace the current plain grey (`bg-muted`) placeholder chips in the WhatsApp config sheet with the purple-filled rounded badges used across the rest of the platform for visual consistency.

## Change

**`src/components/settings/WhatsAppIntegrationDetail.tsx`** — lines 87-97

Update the placeholder button styling from:
```
bg-muted text-muted-foreground rounded-md
```
to the purple badge style matching the `placeholder-badge` pattern:
```
bg-purple-500/15 text-purple-600 border border-purple-500/40 rounded-full font-medium
dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/50
hover:bg-purple-500/25 hover:border-purple-500/60
```

This is a single-line className change on the `<button>` elements inside the placeholder chip row. No structural or logic changes needed.

