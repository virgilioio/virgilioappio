# Consolidate empty states into one source of truth

Today empty states live in **6+ implementations** and dozens of hand-rolled inline blocks. This plan unifies them into a single canonical primitive at `src/components/ui/empty-state.tsx`, then migrates every call site. **No copy/visual changes yet** — that comes in a follow-up plan once the foundation is in place.

---

## 1. The canonical primitive

**File:** `src/components/ui/empty-state.tsx` (replaces the current file)

One component, four variants. Composition over configuration.

```tsx
<EmptyState
  variant="page" | "table-row" | "chart" | "inline"
  // Visual
  mascot?: boolean                      // default true — show Gio face
  icon?: LucideIcon                     // alternative to mascot
  assetType?: PlatformAssetType         // optional DB-driven hero image (page only)
  // Copy
  title: ReactNode                      // purple period auto-appended
  description?: ReactNode
  // Action
  action?: { label: string; onClick: () => void; variant?: ButtonVariant }
  secondaryAction?: { label: string; onClick: () => void }
  // Layout
  size?: 'sm' | 'md' | 'lg'             // default md
  className?: string
  // Table-row only
  colSpan?: number
/>
```

**Variant specs (locked to Gio Foundation v1.0):**

| Variant       | Use case                                | Size       | Mascot | Padding   |
|---------------|-----------------------------------------|------------|--------|-----------|
| `page`        | Full page / large surface (Jobs, Deals) | 64px image | yes    | py-16     |
| `table-row`   | Inside `<TableBody>` (replaces `TableEmpty`) | none / 20px icon | no | py-12 |
| `chart`       | Inside analytics chart cards            | 40px icon  | no     | py-8      |
| `inline`      | Cards, sheets, side panels (comments, attachments, activity) | 48px | yes | py-10 |

**Typography (all variants):**
- Title: `text-table-name text-text-primary` + auto `<span className="text-purple-period">.</span>`
- Description: `text-body-sm text-text-tertiary`
- Action: standard `<Button>` (no overrides)

**Sub-exports (keep API ergonomic without growing the matrix):**
- `<EmptyState.Page>`, `<EmptyState.TableRow>`, `<EmptyState.Chart>`, `<EmptyState.Inline>` — thin wrappers that set `variant`.
- `<EmptyState.Filtered>` — preset for "no results match filters" with built-in "Clear filters" action.

---

## 2. What gets deleted / collapsed

| Old                                                          | Replacement                                       |
|--------------------------------------------------------------|---------------------------------------------------|
| `src/components/ui/GioEmptyState.tsx`                        | `<EmptyState variant="inline">`                   |
| `src/components/ui/empty-state.tsx` (old `EmptyState`)       | Rewritten as canonical (keeps `assetType` prop)   |
| `src/components/analytics/shared/AnalyticsEmptyState.tsx`    | `<EmptyState variant="chart">`                    |
| `src/components/talent-intelligence/TalentIntelligenceEmptyState.tsx` | `<EmptyState variant="inline">`          |
| `TableEmpty` / `TableFilteredEmpty` in `table-states.tsx`    | Re-export thin wrappers around `<EmptyState variant="table-row">` (so existing imports keep working during migration) |
| Inline empty blocks in `ActivityFeedList`, `NoJobDescriptionCard`, `EmailHistoryList`, `CandidateComments`, `CandidateReminders`, `CandidateAttachments`, `CandidateUrls`, `NotificationCenter`, `UpcomingActivities`, `DealPaymentsCard`, `DealInvoicesCard`, `SavedCandidatesTab`, `ArchivedCandidatesTab`, etc. | `<EmptyState variant="inline">`                   |

`platform_assets` integration (DB-driven hero images for organizations/jobs/candidates/members/etc.) is **preserved** — moves into the `page` variant under `assetType`.

---

## 3. Migration plan (one PR per phase, all behind same primitive)

**Phase A — Foundation (no behavior change)**
1. Implement new `EmptyState` in `src/components/ui/empty-state.tsx`.
2. Keep `TableEmpty` / `TableFilteredEmpty` exports in `table-states.tsx` but reimplement them as thin wrappers → zero churn for table call sites.
3. Re-export `GioEmptyState`, `AnalyticsEmptyState`, `TalentIntelligenceEmptyState` as deprecated wrappers around the new primitive (logged once via console.warn in dev only).

**Phase B — Migrate call sites (mechanical)**
- Analytics: `AnalyticsChartCard`, `AnalyticsTableCard`, `TalentInsightsSection`, `OfferAnalyticsSection`, `TalentPoolComposition`, `GeographyInsights`, `CompensationInsights` → `variant="chart"`.
- Cards/sheets: `ActivityFeedList`, `CandidateComments`, `CandidateReminders`, `CandidateAttachments`, `CandidateUrls`, `EmailHistoryList`, `NoJobDescriptionCard`, `NotificationCenter`, `UpcomingActivities`, `ApplicationReviewCard`, `DealPayments/InvoicesCard`, `SavedCandidatesTab`, `ArchivedCandidatesTab` → `variant="inline"`.
- Pages: `Jobs`, `Deals`, `TalentIntelligence`, `Find`, `Organizations`, `Members` → `variant="page"` (preserves `assetType`).
- Tables: keep using `TableEmpty` import (now a wrapper) — no edits required.

**Phase C — Cleanup**
- Delete `GioEmptyState.tsx`, `AnalyticsEmptyState.tsx`, `TalentIntelligenceEmptyState.tsx`.
- Inline the table wrappers (collapse `TableEmpty` → direct `<EmptyState variant="table-row">`) OR keep as semantic re-exports (TBD with you — leaning **keep** for table grammar clarity).

---

## 4. Style guide + memory updates

- Add **§7 Empty States** to `docs/style-guide.md` documenting the 4 variants, props, and when to use which.
- Update memory `mem://style/ui/standardized-empty-states` to point at the canonical primitive.
- Add Core rule one-liner: *"Empty states: single `<EmptyState>` primitive — variants `page | table-row | chart | inline`. No hand-rolled blocks."*

---

## 5. Out of scope (next plan)

Once consolidation lands, we'll do a **separate** plan for:
- Copy refresh (titles, descriptions)
- Mascot pose variants (sad / searching / celebrating)
- Illustration vs. icon decisions per surface
- Action button conventions per empty state

---

## Technical notes

- New primitive is **presentation-only** — no data fetching except the existing `platform_assets` lookup (which only runs when `assetType` is passed).
- Purple period rendering is centralized — call sites pass plain title strings.
- `colSpan` is required when `variant="table-row"` (TS discriminated union enforces it).
- All sizes use existing tokens (`text-table-name`, `text-body-sm`, `text-text-tertiary`, `text-purple-period`, `virgilio-purple`). No new CSS.
- Tree-shakeable: sub-exports are static properties, not separate modules.

Ready to implement Phase A as soon as you approve.
