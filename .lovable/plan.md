

# Deactivation Wall for Inactive Users

## Problem
When a user is deactivated (`user_status = 'inactive'`), `resolve_org_context` skips their member record and returns `guest` with no org context. The app treats them identically to a brand-new user with no organization, redirecting them to onboarding — which is confusing and incorrect.

## Solution
Return a distinct signal (`user_type = 'deactivated'`) from the database when the user has a member record but it's inactive, then show a clear deactivation wall in the frontend.

## Changes

### 1. Update `resolve_org_context` RPC (new migration)
- After the existing active-member lookup returns `NOT FOUND`, add a check: does the user have any `inactive` member record?
- If yes, return `(null, null, 'deactivated')` instead of `(null, null, 'guest')`
- This gives the frontend a clear signal

### 2. Create `DeactivatedWall` component
**New file: `src/components/auth/DeactivatedWall.tsx`**
- Full-screen centered card with a shield/lock icon
- "Your account has been deactivated" heading
- "Contact your administrator to regain access" description
- Shows the user's email for reference
- A "Sign out" button (so they can switch accounts)

### 3. Handle `deactivated` user type in `OrgGate`
**File: `src/components/auth/OrgGate.tsx`**
- Before the `!hasOrganizationContext` fallback, check if `userType === 'deactivated'`
- If so, render the `DeactivatedWall` component instead of the "Organization Access Required" card

### 4. Handle `deactivated` in `RequireAuth` (App.tsx)
**File: `src/App.tsx`**
- In the `RequireAuth` component, after org context is ready, check if `userType === 'deactivated'`
- If so, render the `DeactivatedWall` instead of redirecting to `/onboarding`

### Files Summary
| File | Action |
|------|--------|
| New migration SQL | Update `resolve_org_context` to return `'deactivated'` for inactive members |
| `src/components/auth/DeactivatedWall.tsx` | New — deactivation wall UI |
| `src/components/auth/OrgGate.tsx` | Check for `deactivated` user type |
| `src/App.tsx` | Check for `deactivated` in `RequireAuth` |

