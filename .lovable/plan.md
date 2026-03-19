

# Deactivated Members: Exclude from Counts & Gray Out UI

## Problem
Deactivated members (`user_status === 'inactive'`) are still counted as paid or free seats in the stat cards and appear with full-color styling in the table, which is misleading.

## Changes

### 1. Exclude deactivated members from seat counts
**File: `src/components/settings/MembersTab.tsx`**
- Update `paidCount` and `freeCount` to only count members where `user_status !== 'inactive'`
- Set `seatType` to `undefined`/`null` for inactive members so they show no seat badge
- Add a third stat card or counter for "Deactivated" members (gray styling)

### 2. Gray out deactivated rows in the table
**File: `src/components/members/MembersTable.tsx`**
- Add `opacity-50` and desaturated styling to the entire `TableRow` when `member.user_status === 'inactive'`
- Gray out the avatar (grayscale filter)
- Show the role badge in a muted/gray variant instead of the colorful one
- Keep the "Inactive" status badge as-is (already gray via `status-inactive`)
- Hide the seat badge for deactivated members (no paid/free label)

### 3. Update badge for inactive role display
**File: `src/components/members/MembersTable.tsx`**
- In the Role column, if `user_status === 'inactive'`, render with `variant="secondary"` (gray) instead of the role-specific color

### Files Summary
| File | Change |
|------|--------|
| `src/components/settings/MembersTab.tsx` | Exclude inactive from paid/free counts, add deactivated count |
| `src/components/members/MembersTable.tsx` | Gray out inactive rows (opacity, grayscale avatar, muted role badge, no seat badge) |

