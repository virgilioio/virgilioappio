

# Mobile-Responsive Public Booking Page (Calendly-Style Steps)

## Problem

The public booking page uses a 3-column desktop layout (`grid-cols-[320px_1fr_340px]`) that doesn't adapt for mobile. The calendar card tries to do inline side-by-side expansion (calendar + time slots) with fixed pixel widths that break on small screens.

## Solution — Step-Based Mobile Flow

On mobile, convert the booking flow into sequential steps like Calendly:

**Step 1: Date Selection** — Full-width calendar (hide InterviewerCard and QuickSchedulePanel)
**Step 2: Time Selection** — Full-width time slots list with back button
**Step 3: Confirmation** — Full-width booking form with back button

Desktop remains unchanged.

## Changes

### `src/pages/PublicBookingPage.tsx`

1. **Import `useIsMobile`** hook

2. **Add mobile step state**: `const [mobileStep, setMobileStep] = useState<'date' | 'time' | 'confirm'>('date')`

3. **Mobile step transitions**:
   - When `selectedDate` is set and has time slots → auto-advance to `'time'` step
   - When `selectedSlot` is set → auto-advance to `'confirm'` step
   - Back buttons go to previous step and clear relevant selections

4. **Mobile layout** (inside the `isMobile` conditional):
   - **Step 'date'**: Show only the calendar card full-width. Include event type info and timezone below. Hide the InterviewerCard and QuickSchedulePanel entirely.
   - **Step 'time'**: Show only the TimeSlotsList full-width in a card. Add a back button that clears `selectedDate` and returns to step 'date'.
   - **Step 'confirm'**: Show only the BookingConfirmationForm full-width. Back button clears `selectedSlot` and returns to step 'time'.

5. **Desktop layout** (existing): No changes — keep the 3-column grid with inline expansion as-is.

6. **Calendar card on mobile**: Remove the inline time-slots expansion. The calendar takes full width without the `maxWidth: calc(100% - 260px)` squeeze. The time slots panel (`w-[260px]`) is hidden on mobile since it's shown in step 2 instead.

7. **Event type picker + empty states**: Already full-width cards, work fine on mobile — no changes needed.

### Key mobile UX details
- Step indicator text at top (e.g., "Step 1 of 3 · Select a date") for orientation
- Interviewer name/duration shown as a compact header line on mobile (not the full InterviewerCard)
- "Back to options" button (event type picker) still works on mobile

## Files changed

| File | Change |
|------|--------|
| `src/pages/PublicBookingPage.tsx` | Add `useIsMobile`, mobile step state, conditional mobile vs desktop rendering |

