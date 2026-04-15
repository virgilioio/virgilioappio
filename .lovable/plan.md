

# Fix: "Unknown" Members in Add Collaborators Dropdown

## Root Cause

The `useSourcingProjectCollaborators` hook queries the `profiles` table using `.in('id', userIds)`, but the `profiles` table has no `id` column — its primary key is `user_id`. This causes the profile lookup to return zero results, so every member renders as "Unknown".

This affects both:
1. The **collaborator list** (existing collaborators show as unknown)
2. The **tenant members dropdown** (invite search shows unknowns)

## Fix — 1 file change

In `src/hooks/useSourcingProjectCollaborators.ts`, replace all `.in('id', userIds)` with `.in('user_id', userIds)` and update the profile map to key on `p.user_id` instead of `p.id`.

**Three locations to fix:**

1. **Line ~50** (collaborator enrichment): `.in('id', userIds)` → `.in('user_id', userIds)`
2. **Line ~53**: `profileMap` keyed on `p.id` → `p.user_id`
3. **Line ~102** (tenant members): `.in('id', userIds)` → `.in('user_id', userIds)`
4. **Line ~107**: profile map keyed on `p.id` → `p.user_id`

Also update the select from `'id, first_name, ...'` to `'user_id, first_name, ...'` in both queries.

## Scope
- 1 file edit (`src/hooks/useSourcingProjectCollaborators.ts`)
- No database changes needed

