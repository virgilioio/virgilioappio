# Restructure Deal Profile Sheet to match Candidate Profile patterns

Reuse existing components from `CandidateProfileSheet` so the deal sheet inherits the same look-and-feel — no new visual language.

## 1. Tab card (reuse `CandidateNameCard`)

Replace the current shadcn `Tabs`/`TabsList` block in `DealProfileSheet.tsx` with `CandidateNameCard` (the same component used in the candidate sheet at line 1295). It already renders the tab strip inside a `Card` with the proper Opaline styling.

Tabs passed in:
- `{ value: 'overview', label: 'Deal Overview', Icon: LayoutGrid }` (renamed from "Overview")
- `{ value: 'billing', label: 'Billing & Invoices', Icon: Receipt }` (new)
- `{ value: 'notes', label: 'Notes', Icon: StickyNote }` (existing)

`CandidateNameCard` requires `name` + `tabs`/`activeTab`/`onTabChange`. Pass the deal title as `name`. Drop the existing `<Tabs>` wrapper and switch tab content with `activeTab === '...'` conditionals (same pattern used in `CandidateProfileSheet`).

## 2. Deal Details card (mirror `CandidateDetailsCollapsible`)

Create `src/components/deals/DealDetailsCollapsible.tsx` using `CandidateDetailsCollapsible.tsx` as the structural template:
- `Card` + `Collapsible` with `CardTitle="Deal Details"`.
- Collapsed summary row (desktop): amount + currency, company name, owner avatar+name.
- Expanded body grid showing the existing `Field` rows currently inline in the Overview tab — Owner, Company, Amount, Expected close, plus Description if present.
- Same icon treatment (`DollarSign`, `Building2`, `User`, `Calendar`) and `text-xs text-text-secondary` typography as the candidate card.

Render this card at the top of the **Deal Overview** tab content (replacing the floating `grid grid-cols-2` Field block currently in `TabsContent value="overview"`).

## 3. Stage stepper inside the sheet (mirror Job Overview accordion)

Below the Deal Details card on the Deal Overview tab, add a `Card` titled "Pipeline Stages" reusing the `Accordion` pattern from `CandidateProfileSheet` lines 1320–1500:

- Iterate `useDealStages()` ordered by `position`.
- For each stage render an `AccordionItem` with the stage name, a `CheckCircle2` (past/current) or `Circle` (future) icon, and a small `Badge` for `stage_type` (open / won / lost) using the same variants as `DraggableDealStageItem`.
- Header background tint mirrors `getHeaderBgClass` logic (won → success tint, lost → muted/error tint, open → neutral).
- Inside the open item:
  - If it's the current stage: show a "Current stage" label.
  - If it's not current: show a `Button variant="outline"` with `<MoveRight />` "Move to this stage" that calls `moveDeal.mutate({ id: deal.id, stage_id: stage.id })` (already in `useDealMutations`). Disable while pending.
- Keep the existing top-of-sheet "Mark won" / "Mark lost" quick-action row — these become shortcuts to specific stages, same as candidate quick actions.

## 4. Billing & Invoices tab (new, scaffold only)

New tab content rendered when `activeTab === 'billing'`:
- A single `Card` with `CardTitle="Billing & Invoices"`.
- Body uses `GioEmptyState` with title "No invoices yet" and description "Invoices linked to this deal will appear here." plus a disabled "Add invoice" button placeholder.

This mirrors the empty-state treatment used elsewhere and gives a stable surface for follow-up work without inventing new data flows in this pass.

## 5. Cleanups

- Remove the now-unused `Tabs/TabsList/TabsTrigger/TabsContent` imports and the inline `grid grid-cols-2` Field block from `DealProfileSheet.tsx` (the `Field` helper can stay for use inside `DealDetailsCollapsible`, or be moved into that file).
- Notes tab body stays exactly as-is, just rendered conditionally on `activeTab === 'notes'`.

## Files

- Edit: `src/components/deals/DealProfileSheet.tsx`
- Create: `src/components/deals/DealDetailsCollapsible.tsx`

No DB changes, no new dependencies, no changes to `useDeals` / `useDealStages` / `useDealMutations`.
