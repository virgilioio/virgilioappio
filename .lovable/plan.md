

# Fix Candidate Profile Sheet Loading: Unified Gate + Skeleton Styling

## Problems

1. **Chunky loading**: The sheet header (candidate name, action buttons, badges) renders immediately with "Loading..." text while the body shows the skeleton. This creates a two-phase load where the header pops in with data after the skeleton disappears.

2. **Skeleton border mismatch**: `CandidateProfileSkeleton` wraps skeleton blocks in `<div className="rounded-xl border border-border bg-surface-primary ...">`, adding visible card borders. No other skeleton in the app does this — the base `Skeleton` component is just `bg-virgilio-border/30` with no border. This makes the profile skeleton look out of place.

## Plan

### 1. Gate the entire sheet behind the loading skeleton

**Both `IndependentCandidateProfileSheet.tsx` and `CandidateProfileSheet.tsx`:**

Move the loading check **above** the `SheetHeader` so that when `loading` is true (or `!candidate`), the entire sheet content area — including the header — is replaced by the skeleton. Currently the skeleton only covers the scrollable body below the header.

- Wrap the `SheetHeader` + body content in a single conditional: if `loading`, show `CandidateProfileSkeleton` with padding; otherwise render the header and body as normal.
- This prevents the "Loading..." name text and flickering buttons.

### 2. Remove borders from `CandidateProfileSkeleton`

**`CandidateProfileSkeleton.tsx`:**

Remove `border border-border bg-surface-primary` from all wrapper `<div>`s (lines 11, 32, 45, 55, 66, 80). Replace with just `space-y-*` and `p-5` padding — matching the borderless style used by `SearchResultsSkeleton`, `CandidateTableSkeleton`, and the base `Skeleton` component. The skeleton blocks themselves (`<Skeleton>`) already have their own subtle background.

| File | Change |
|---|---|
| `CandidateProfileSkeleton.tsx` | Remove `rounded-xl border border-border bg-surface-primary` from 6 wrapper divs |
| `IndependentCandidateProfileSheet.tsx` | Move loading gate to wrap entire sheet content (header + body) |
| `CandidateProfileSheet.tsx` | Same loading gate treatment |

