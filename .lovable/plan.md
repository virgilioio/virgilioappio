

# Fix Paid Seats Count in Members Tab

## Problem

Two issues with the billable seat calculation in `MembersTab.tsx`:

1. **Inconsistent org filter**: `paidMembers` filters by `organization_id === parentOrgId`, but `collaboratorMembers` does NOT apply this filter. A member who is billable but belongs to a different org would disappear from both lists.

2. **Tab labels are unclear**: "Members" vs "Collaborators" doesn't clearly communicate the billing distinction. The "Paid Seats" card label is correct but the tab naming is vague.

## Changes

**File: `src/components/settings/MembersTab.tsx`**

1. **Apply the same org filter to both lists** — filter all members by parent org first, then split into billable vs collaborator:

```tsx
const orgMembers = members.filter(
  (m) => !parentOrgId || m.organization_id === parentOrgId
)
const paidMembers = orgMembers.filter((m) => isBillableMember(m))
const collaboratorMembers = orgMembers.filter((m) => !isBillableMember(m))
```

2. **Update tab labels** to clarify billing: rename "Members" tab to "Paid Seats" and "Collaborators" stays as-is.

3. **Add a subtitle under the "Paid Seats" stat card** with a brief explanation: `Admins & Recruiters`.

4. **Add a subtitle under the "Collaborators" stat card**: `Hiring Managers & Interviewers`.

