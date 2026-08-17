# Fix: assigning a hiring team member freezes the screen

## What's happening

The default role in the "Manage hiring team" modal is **Recruiter**, and Recruiter is a paid seat. So when you pick a free collaborator and click **Assign**, the code opens the "This will add a paid seat" confirmation instead of assigning immediately.

That confirmation never becomes visible: the hiring-team modal paints its own overlay and card at layers 60/70, while the seat-confirmation dialog is a standard alert dialog at layer 50. It renders *underneath* the hiring-team overlay — but it still traps focus and swallows clicks. Result: the screen dims and nothing is clickable, exactly as you describe.

Two smaller issues in the same modal:

- The "Add a person" results list is rendered inline inside the modal card, so it gets clipped by the card's bounds instead of floating above it.
- The confirmation copy talks about billing but gives no way out visually, so there is no escape hatch once it's stuck.

## The fix

1. **Layer the seat confirmation above the hiring-team modal.** Give the seat-upgrade confirmation an explicit layer above 70 (overlay and content), so it appears on top of the hiring-team card. It stays the same dialog with the same copy, seat math, Confirm, and Cancel behavior — only stacking changes.
2. **Move it out of the hiring-team dialog subtree** so it portals to the body as a true sibling, rather than nesting inside a dialog root that is also managing an overlay.
3. **Float the person-search results.** Render the search dropdown in a popover-style floating panel anchored to the input (standard menu chrome: radius 12, pad 4, 30px items, hover `#F1F0EC`) so it can overflow the modal instead of being cut off.

## Guardrails

- No change to the assignment mutation, the per-job role model (Recruiter / Hiring Manager / Interviewer), seat-upgrade detection, paid-seat counting, or permissions.
- The paid-seat confirmation still gates Recruiter assignments — it becomes visible, not skipped.
- The seat-confirmation component is shared with the Members tab; the layering change is additive and won't regress its use there.

## Technical notes

- `src/components/jobs/HiringTeamManageDialog.tsx`: `<SeatUpgradeConfirmDialog>` currently sits inside `DialogPrimitive.Root` after the `Portal`; hoist it out of that dialog's tree, keeping the same `seatConfirm` state and callbacks.
- `src/components/billing/SeatUpgradeConfirmDialog.tsx`: pass through explicit z-index classes on `AlertDialogContent` (and its overlay) so nested usage lands above `z-[70]`.
- Search dropdown: replace the inline results block with a `Popover`/anchored panel using `src/lib/menu-classes.ts` chrome, keeping the existing filter, 25-item cap, and selection handler.

## Verification

- Open Job → Setup → Hiring team → Add member, pick a free collaborator, leave role Recruiter, click Assign: the paid-seat dialog appears on top and is readable; Cancel returns to a fully interactive modal; Confirm assigns the person and clears the picker.
- Assign someone as Hiring Manager or Interviewer: assigns immediately, no confirmation.
- Assign an existing Admin/Recruiter as Recruiter: no confirmation (already a paid seat).
- Type in "Add a person": the results list floats over the modal edges and isn't clipped; Escape closes the list, not the modal.
- Change an existing assignee's role to Recruiter from the list: same confirmation appears on top and works.
