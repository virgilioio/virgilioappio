

# Fix Dialog to 3:3:1 Three-Column Layout

## Change

Restructure the body in `IntegrationDetailDialog.tsx` (lines 134–195) from a two-column layout into **three columns** with a **3:3:1 ratio** (out of 7 parts):

```text
┌──────────────────────────────────────────────────┐
│  Header: Icon + Title + Badge                    │
├────────────────┬───────────────┬─────────────────┤
│                │               │                 │
│  Images        │  Description  │  Action         │
│  (3/7 ≈ 43%)  │  (3/7 ≈ 43%) │  Buttons        │
│                │  scrollable   │  (1/7 ≈ 14%)   │
│                │               │  centered       │
│                │               │                 │
└────────────────┴───────────────┴─────────────────┘
```

- **Column 1** `sm:w-[43%]` — Image carousel (unchanged content)
- **Column 2** `sm:w-[43%]` — Description/detail content, scrollable
- **Column 3** `sm:w-[14%]` — Action buttons (Install/Uninstall/Configure), vertically centered, left border separator

### File: `IntegrationDetailDialog.tsx` (lines 134–195)

Replace the two-column body with three columns. Buttons move out of the description column into their own right-side column.

