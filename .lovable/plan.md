

# Add Team Member Autocomplete to Guest Email Input

## What changes

Enhance `GuestEmailInput` to show an autocomplete dropdown of organization members when the user types a name or email. Members appear as suggestions with name + email; selecting one adds their email as a guest. Users can still type arbitrary emails manually.

## Files changed

| File | Change |
|------|--------|
| `src/components/scheduling/GuestEmailInput.tsx` | Add `organizationId` prop; use `useCustomerMembers` to fetch team members; filter by input text (match against name or email); render autocomplete dropdown below input; selecting a suggestion adds the member's email; show member name + email in badges when the email matches a known member |
| `src/components/candidates/ScheduleInterviewSheet.tsx` | Pass `organizationId` to `GuestEmailInput` |
| `src/components/candidates/SimpleScheduleInterviewSheet.tsx` | Pass `organizationId` to `GuestEmailInput` (need to check if it has access — may need to thread it through) |

## How autocomplete works

1. `GuestEmailInput` receives optional `organizationId` prop
2. When provided, it calls `useCustomerMembers(organizationId)` to get all org members with profiles
3. As the user types, filter members whose `first_name`, `last_name`, or `email` contains the input (case-insensitive), excluding already-added emails
4. Show a dropdown (absolute positioned, similar to `AutocompleteTagInput` pattern) with matching members: avatar initials + full name + email
5. Clicking a suggestion or pressing Enter/ArrowDown+Enter adds that member's email
6. User can still type a full email and press Enter to add non-member guests
7. Badges show the member's name instead of raw email when the email belongs to a known member

## UI details

- Dropdown appears after 1+ characters when matches exist
- Each suggestion row: colored initials circle + "First Last" + email in muted text
- Keyboard navigation (ArrowUp/Down/Enter/Escape) matching existing `AutocompleteTagInput` pattern
- Badges display "First Last" with email as tooltip for known members, raw email for external guests

