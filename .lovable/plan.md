## Goal

Wrap the Deals kanban board in a `Card` with a header (matching the Pipeline Overview pattern used in the Job page and the Companies/Departments table). Move the Amount filter chip and the "New Deal" button out of the global `PageHeader` and into that new card header. Then rename the Companies page button to "Create Company" and align both primary buttons to the same exact size.

## Changes

### 1. Deals page — add a card header around the kanban (`src/pages/Deals.tsx` + `src/components/deals/DealsKanbanBoard.tsx`)

- In `DealsKanbanBoard`, accept two render slots: `headerLeft` (filter chip) and `headerRight` (action button). Wrap the existing kanban content inside a `Card` with a `CardHeader` that lays them out:
  ```
  <Card className="flex-1 min-h-0 flex flex-col">
    <CardHeader>
      <div className="flex flex-wrap items-center gap-2">
        {headerLeft}
        <div className="ml-auto">{headerRight}</div>
      </div>
    </CardHeader>
    <CardContent className="flex-1 min-h-0 ...">
      {/* existing kanban columns */}
    </CardContent>
  </Card>
  ```
  This mirrors the existing wrapper used in `OrganizationsTable` (Card + CardHeader with `ml-auto` action) and the visual rhythm of `PipelineOverview` (controls row above the columns).

- In `Deals.tsx`, remove the chip + button from `<PageHeader title="Deals">` (the page header keeps only the title, per our PageHeader standard) and pass them into the board:
  ```tsx
  <DealsKanbanBoard
    onOpenDeal={setOpenDealId}
    amountMode={amountMode}
    headerLeft={
      <FilterChipSelect label="Amount" value={amountMode} options={AMOUNT_MODE_OPTIONS} onChange={(v) => setAmountMode(v as DealAmountMode)} />
    }
    headerRight={
      <Button onClick={() => setCreating(true)} className="gap-2 whitespace-nowrap">
        <Plus className="h-4 w-4" /> New Deal
      </Button>
    }
  />
  ```

### 2. Companies page — rename and align button (`src/components/organizations/OrganizationsTable.tsx`)

- Rename the primary action label from `Create Department` → `Create Company` in:
  - The `CardHeader` button (line ~177).
  - The empty state `action.label` (line ~195).
- Keep the existing button styling (`className="gap-2 whitespace-nowrap"`, default size, `Plus h-4 w-4`) — this becomes the canonical sizing.

### 3. Match button sizing across both pages

- The new "New Deal" button in the deals card header uses the exact same props and classes as "Create Company": default `Button` size, `gap-2 whitespace-nowrap`, `<Plus className="h-4 w-4" />`. No `size="sm"` and no `h-8`.

## Out of scope

- No changes to other "Create Department" labels elsewhere in the app (Job wizard, AI assistant, sourcing) — those refer to org/departments and were not requested.
- No changes to amount mode logic, totals, badges, or kanban behavior.
- No changes to permissions or routing.

## Files touched

- `src/pages/Deals.tsx`
- `src/components/deals/DealsKanbanBoard.tsx`
- `src/components/organizations/OrganizationsTable.tsx`
