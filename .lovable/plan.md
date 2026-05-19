# Dropdown grayout fix + drag-to-schedule on FREE row

## 1. Dropdowns: items look grayed everywhere

### Root cause

`src/lib/menu-classes.ts` applies opacity 45 with both `data-[disabled]:opacity-45` and `data-[disabled=true]:opacity-45`.

The bare `data-[disabled]` selector matches **whenever the attribute is present** regardless of value. The cmdk library (used by `CommandItem`, which backs `<Select>`, `<SearchableSelect>`, `<CurrencySelect>`, `<FilterChipPopover>`, `<DatePickerVirgilio>`, and the panelist combobox) emits `data-disabled="false"` on every enabled item. Result: every cmdk-based dropdown item is rendered at 45% opacity by default and looks blocked.

Radix Select sets `data-disabled` with an empty value only when the item is actually disabled — it relies on the same broken selector for the legitimate disabled state.

### Fix

In `menu-classes.ts`, replace the bare-attribute selector with two explicit ones:

- `data-[disabled=true]` → cmdk's actual disabled state
- `data-[disabled='']` → Radix's actual disabled state

Enabled cmdk items (`data-disabled="false"`) will no longer match, returning to full opacity. Truly disabled items in both libraries keep the 45% opacity + `pointer-events-none`.

No other dropdown code or call sites change.

## 2. Drag-to-schedule on the FREE row

### Current state

The FREE row in `ScheduleInterviewSheet` renders each available slot as a clickable button positioned along a 9 AM–5 PM horizontal scale. Picking a time means clicking one of the precomputed slots; nothing is draggable.

### What changes

After the recruiter picks any slot (or auto-picks the first), the selected slot becomes a draggable pill on the FREE row:

- Press and drag the pill horizontally. The pill follows the cursor in real time using a CSS `translate3d` transform (no React state churn per pixel).
- A live tooltip above the pill shows the new start time as the cursor moves (e.g. `10:45 AM`), updating at the row's snap quantum.
- On release, the pill snaps to the **nearest valid available slot** (only times that pass the real-time calendar check are valid landing zones; the day's `availability_data` is the source of truth).
- If released over an unavailable region, the pill animates back to its last valid position with a subtle bounce — no scheduling happens silently in an unavailable slot.
- Duration stays fixed to the stage's selected duration; only the start time changes. (Resize is out of scope.)
- Visual feedback during drag: pill scales 1.02 with stronger shadow, the underlying FREE row shows tick marks at every valid slot boundary as a lilac dot, and invalid regions stay flat white.

### Implementation outline

- Add a `useDraggablePill` hook local to the file (no new deps) using pointer events with capture, snapping `(clientX - rowLeft) / rowWidth * 8h + 9h` to the nearest entry in `timeSlotsForSelectedDate`.
- Promote the existing button-per-slot to a single draggable pill anchored to `selectedSlot`. Non-selected slots remain visible as faint tick marks behind the pill.
- Keyboard parity: `←` / `→` move to previous / next available slot; `Home`/`End` jump to first/last.
- Touch parity: pointer events handle touch natively; passive=false on `pointermove` to allow preventDefault and stop page scroll while dragging.

No backend, schema, or RLS changes. No edits to `useStageBookingInterviewers` or to the booking write path.

## Files

- `src/lib/menu-classes.ts` — selector fix.
- `src/components/candidates/ScheduleInterviewSheet.tsx` — FREE row drag interaction.

## Out of scope

- Resize handles on the pill (changing duration by dragging edges).
- Drawing a brand-new slot by clicking on empty space.
- Cross-day drag.
- Group mode (`scheduling_mode === 'all'`).
