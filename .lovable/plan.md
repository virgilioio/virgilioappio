

# 4:2:2 Grid + Card-Style Tabs (No Nesting)

## Changes — `src/components/candidates/ApplicationReviewSheet.tsx`

### 1. Grid ratio: 3:3:2 → 4:2:2
- Column 1 (Resume): `col-span-3` → `col-span-4`
- Column 2 (Tabs): `col-span-3` → `col-span-2`
- Column 3 (Controls): stays `col-span-2`

### 2. Card-style tabs structure (flat, no nesting)

```text
CardHeader
└── TabsList (triggers)
TabsContent "responses"
└── CardContent → CandidateApplicationResponses
TabsContent "ai-summary"
└── CardContent → ProfileSummaryMarkdown
```

The `Tabs` component wraps everything. Inside it: `CardHeader` holds the `TabsList`, and each `TabsContent` directly contains a `CardContent` for the body. No outer Card, no cards-in-cards.

### File
Single file, ~10 lines changed in Column 1 class and Column 2 JSX.

