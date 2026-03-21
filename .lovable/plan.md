

# Remove "Showing X of Y" Text + Reduce Header/Title Size

## 1. Remove "Showing X of Y" across all tables

Delete the "Showing X-Y of Z" text from the pagination footer area in these files:

| File | Lines to remove |
|------|----------------|
| `src/components/candidates/CandidateTable.tsx` | ~lines 553-559 (the div with FileText icon + "Showing..." text) |
| `src/components/candidates/IndependentCandidateTable.tsx` | ~lines 620-626 |
| `src/components/jobs/JobsTable.tsx` | ~lines 473-479 |
| `src/components/organizations/OrganizationsTable.tsx` | ~lines 267-273 |
| `src/components/sourcing/SourcingCandidateTable.tsx` | ~lines 811-814 |
| `src/components/members/MembersTable.tsx` | ~line 304-306 |
| `src/components/admin/AdminAuditLog.tsx` | ~lines 228-230 |

Keep any pagination controls that exist alongside — just remove the "Showing" count text.

## 2. Reduce page title size by 30%

**`tailwind.config.ts`** — Update the heading font sizes:

| Token | Current | New (~30% smaller) |
|-------|---------|---------------------|
| `h1-mobile` | 34px | 24px |
| `h1-desktop` | 48px | 34px |
| `h2-mobile` | 28px | 20px |
| `h2-desktop` | 36px | 25px |
| `h3-mobile` | 22px | 16px |
| `h3-desktop` | 28px | 20px |
| `h4-mobile` | 18px | 13px |
| `h4-desktop` | 22px | 16px |

## 3. Reduce header section vertical padding

**`src/index.css`** — Reduce `--layout-padding-md` from `1rem` (16px) to `0.625rem` (10px). This tightens the `Section` `py-layout-md` used by all page headers.

Also reduce `--layout-padding-lg` from `1.5rem` to `1rem` for the `PageHeader` bottom padding (`pb-lg`).

## 4. StyledPageTitle consistency

**`src/components/ui/styled-page-title.tsx`** — Change `text-2xl md:text-3xl` to use the design system tokens `text-h1-mobile md:text-h1-desktop` so it automatically picks up the new sizes.

## Files

| File | Change |
|------|--------|
| `tailwind.config.ts` | Reduce h1-h4 font sizes by ~30% |
| `src/index.css` | Reduce `--layout-padding-md` and `--layout-padding-lg` |
| `src/components/ui/styled-page-title.tsx` | Use design system heading tokens |
| `src/components/candidates/CandidateTable.tsx` | Remove "Showing" text |
| `src/components/candidates/IndependentCandidateTable.tsx` | Remove "Showing" text |
| `src/components/jobs/JobsTable.tsx` | Remove "Showing" text |
| `src/components/organizations/OrganizationsTable.tsx` | Remove "Showing" text |
| `src/components/sourcing/SourcingCandidateTable.tsx` | Remove "Showing" text |
| `src/components/members/MembersTable.tsx` | Remove "Showing" text |
| `src/components/admin/AdminAuditLog.tsx` | Remove "Showing" text |

