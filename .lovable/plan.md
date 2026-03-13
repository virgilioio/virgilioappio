

# Add Card Wrapper to Middle Column Tabs

## What
Wrap the entire `Tabs` block in Column 2 of `ApplicationReviewSheet.tsx` inside a `Card` so the structure becomes:

```text
Card (bg-surface-primary border-border)
└── Tabs
    ├── CardHeader
    │   └── TabsList
    ├── TabsContent "responses"
    │   └── CardContent → ...
    └── TabsContent "ai-summary"
        └── CardContent → ...
```

This matches the profile sheet pattern where every content section lives inside a `Card`.

## Change — `src/components/candidates/ApplicationReviewSheet.tsx`

Single edit in the Column 2 block (~lines 204-237):
- Wrap `<Tabs>` inside `<Card className="bg-surface-primary border-border flex flex-col min-h-0">`
- Move overflow/flex classes from the column div to the Card as needed

