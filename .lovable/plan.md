
# Fix dashboard DnD duplication bug

## What I’ll change

### 1. Harden the layout model in `src/hooks/useDashboardLayout.ts`
Refactor the state helpers so the layout always enforces this invariant:

```text
A card id can exist in exactly one place:
- left
- center
- right
- hidden
```

Planned helpers:
- `findColumnForCard(cardId, columns)` — live lookup from current state
- `removeCardFromAllColumns(cardId, columns)` — strips the card from every column before any insert
- `normalizeColumns(columns)` — defensive dedupe pass that guarantees uniqueness after each mutation

Then update the mutation methods:
- `moveCardToColumn(...)`  
  - resolve from live state
  - remove from all columns first
  - insert once at the target index
  - normalize before returning
  - no-op if the effective placement did not change
- `reorderWithinColumn(...)`
  - operate on a cleaned column array
  - normalize result before returning
- `showCard(...)` / `hideCard(...)`
  - make them uniqueness-safe too, so hidden/add flows can never reintroduce duplicates

### 2. Fix stale drag source usage in `src/pages/Dashboard.tsx`
Refactor the DnD handlers so they never trust `active.data.current?.columnId` after drag start.

Instead:
- on every `handleDragOver`, derive the active card’s current column from the latest runtime `columns` state via `findCardColumn(activeCardId)`
- derive the target column from the current hovered item/column
- skip repeated hover events that would reinsert the card into the same position
- only call cross-column move logic when the target column is actually different

This is the key fix for the corruption bug.

### 3. Make `handleDragEnd` use live state consistently
Update drop handling so:
- same-column drops only reorder within that live column
- cross-column drops do not reinsert again if drag-over already moved the item
- finalize/persist uses the cleaned runtime state

### 4. Add concise comments around the bug-prone logic
I’ll document:
- why `active.data.current?.columnId` becomes stale after the first move
- why all move operations remove from every column before insert
- why normalization runs after mutations

## Why this should fix it

Right now the card can be inserted multiple times because drag-over keeps using the original source column from drag-start metadata.

After the refactor:
- source column always comes from current state
- every move removes the card globally before inserting
- every result is normalized
- duplicate keys and duplicate mounts should stop entirely

## Files to update

- `src/pages/Dashboard.tsx`
- `src/hooks/useDashboardLayout.ts`

## Expected result

- no visual card duplication during drag
- no duplicate React key warnings (`agenda`, `onboarding`, etc.)
- no duplicate widget mounts caused by corrupted layout state
- same dashboard appearance and overall DnD feel, but with stable behavior

## Verification

I’ll validate these flows after implementation:
1. drag within same column
2. drag between columns repeatedly
3. hover back and forth before drop
4. hide → re-add → drag again
5. refresh and confirm persisted layout stays clean
