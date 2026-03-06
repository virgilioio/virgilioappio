

# Fix Member Edit Sheet

## Problem

The `MemberInviteSheet` component ignores the `member` prop entirely. When editing, it shows "Invite New User" with an empty form instead of pre-filling the member's current role and allowing updates.

## Solution

Update `MemberInviteSheet` to detect edit mode (`!!member`) and:

1. **Title/description**: Show "Edit Member" instead of "Invite New User"
2. **Pre-fill form**: Set the role to the member's current `system_role` and email to their email when `member` is provided
3. **Email field**: Show as read-only (disabled) in edit mode — you can't change a member's email
4. **Submit handler**: In edit mode, send only `{ system_role: data.role }` (not invite data with `user_status: 'invited'`)
5. **Button text**: Show "Save Changes" instead of "Send Invitation"

## File to Change

| File | Change |
|---|---|
| `src/components/members/MemberInviteSheet.tsx` | Add edit mode detection, pre-fill form via `useEffect` when `member` changes, adjust title/description/button text, modify `onFormSubmit` to send update data in edit mode |

## Key Detail

The `useEffect` that resets the form on close (line 85-92) already runs on `isOpen` change. A second `useEffect` will set form values when `member` changes:

```typescript
useEffect(() => {
  if (member && isOpen) {
    setValue('email', member.user_email || member.invited_email || '')
    setValue('role', member.system_role || '')
  }
}, [member, isOpen, setValue])
```

In `onFormSubmit`, when `isEditing`:
```typescript
await onSubmit({ system_role: data.role })
onClose()
```

No other files need changes — `MembersTab.tsx` already passes the member and calls `updateMember` in its `handleEditSubmit`.

