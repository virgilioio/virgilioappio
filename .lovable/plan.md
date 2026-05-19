# Promote "Cc additional guests" into a formal GUESTS section

## What changes

Today the guest field lives at the bottom of the **INVITATION** card as a small `<Label>` + `<GuestEmailInput>` (a plain Input + portal dropdown + secondary Badges). It looks like an afterthought compared to **WHAT & WHO**, **WHEN**, **INVITATION**.

We promote it to its own top-level `SectionCard` directly after **INVITATION**, with the exact same visual language as the **Interviewers** field — pill chips + dashed "+ Add guest" pill + popover autocomplete.

## New section structure

```text
┌─ GUESTS ─────────────────────────────────────────── (0/10) ──┐
│  People to Cc on the invite (optional)                       │
│                                                              │
│  Cc'd guests                                                 │
│  [● Jane Doe ×] [● Mark Smith ×] [● ana@acme.io ×] (+ Add guest)
│                                                              │
│  Tip: teammates appear with their name, external emails are  │
│  added as-is and receive the calendar invite.                │
└──────────────────────────────────────────────────────────────┘
```

- `SectionCard label="GUESTS"` with `rightSlot` = small `(N/10)` counter badge.
- One-line subtitle under the title to explain purpose.
- Field label "Cc'd guests" using `text-form-label text-virgilio-muted` (same as Interviewers).
- Chip row + dashed pill trigger + popover, identical chrome to `PanelistComboField`.
- Helper text below in `text-body-xs text-virgilio-muted`.

## Picker behavior (autocomplete)

- Source: `useCustomerMembers(organizationId)` — every teammate in the tenant.
- As the user types in the dashed pill input:
  - Filter teammates by first name, last name, full name, email.
  - Exclude teammates whose email is already chipped.
  - Exclude the candidate's email (defensive) and the already-selected panelists' emails (they're already on the invite).
- Results render as `CommandItem` rows: avatar · name · email muted (mirrors current GuestEmailInput suggestion row but inside the shared Command popover).
- Selecting a teammate adds a **purple chip** (tone="purple", same as panelists) showing their display name; the underlying value stored is the email.
- If the query is a valid email (`EMAIL_REGEX`) and matches no teammate, show a final `CommandItem` "Add 'foo@bar.com' as external guest" (icon: UserPlus). Pressing Enter or clicking adds a **neutral chip** (tone="neutral") showing the raw email.
- Enter on a valid-email query with no teammate match also adds external. Enter on no-match + non-email shows inline hint "Enter a valid email".
- Backspace on empty input removes the last chip (parity with PanelistComboField).
- Escape closes the popover.
- Cap at 10 (existing limit), surface counter in section header right slot; once reached, dashed trigger disables with tooltip "Maximum 10 guests".

## Chip styling

- Teammate guest → `RemovableChip tone="purple" size="md"` with name.
- External email guest → `RemovableChip tone="neutral" size="md"` with email + tiny `Mail` icon to differentiate.
- Hovering a teammate chip shows tooltip with the email; hovering an external chip shows tooltip "External guest".

## Files

- **Edit** `src/components/candidates/ScheduleInterviewSheet.tsx`
  - Remove the current `<div className="pt-3 border-t …"> Cc additional guests …` block (lines ~1197–1208) from the INVITATION SectionCard.
  - Add a new `<SectionCard label="GUESTS" rightSlot={…counter…}>` right after the INVITATION SectionCard, rendering `<GuestComboField …>`.
  - Add a `GuestComboField` component in the same file (mirrors `PanelistComboField` structure) since it is tightly coupled to the sheet's data flow (members, candidate email, selected panelists).
- **No changes** to `GuestEmailInput.tsx` (keep it for any other call sites; not used here anymore).
- **No backend / schema / RLS changes.** `guestEmails: string[]` payload contract is unchanged.

## Out of scope

- Persisting guests beyond what already happens via `createBookingMutation`.
- Inviting guests as panelists (they remain Cc-only).
- Removing or refactoring the legacy `GuestEmailInput` component.
