# Fix: "Reactivate member" does nothing

## What's happening

The row menu's **Reactivate Member** item does not reactivate anything — it simply reopens the member edit dialog. That dialog, in edit mode, submits only the member's role (`system_role`) and never touches the active/inactive status, so the member stays inactive.

Confirmed against the database: victoria@virgilio.tech's member row was updated at 17:02 UTC today (your attempt), but `user_status` is still `inactive` — the write happened, it just never included the status change.

## The fix

1. Add a real `reactivateMember(id)` action alongside the existing deactivate action: it sets the member's status back to active, refreshes the member list, and re-runs the seat sync (so billing seat counts update the same way deactivation does).
2. Point the **Reactivate Member** menu item at that action instead of the edit dialog.
3. Show a short confirmation before reactivating, matching the wording style of the existing deactivate confirmation, and mention that a paid role will re-occupy a billable seat.
4. Handle the seat-limit case: if the workspace is at its seat cap and the member holds a paid role, surface the existing seat-limit message rather than a raw error.

## Scope

- `src/hooks/useMembers.ts` — new `reactivateMember` mutation (mirrors `deactivateMember`).
- `src/components/members/MembersTable.tsx` — new optional `onReactivate` prop used by the menu item.
- `src/components/settings/MembersTab.tsx` and `src/pages/Members.tsx` — wire the handler plus confirm dialog.

No changes to roles, permissions, data shape, or the edit dialog's existing behaviour.
