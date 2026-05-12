## Goal

Lock the CRM (Companies + Deals) to admin-tier users only: **platform admins, workspace owners, or members with `system_role='admin'`**. Members (Hiring Managers), recruiters and Interviewers must not see or access it — at the UI, the route, or the database level.

## Current state

- `usePermissions.canViewOrganizations` already resolves to `isPlatformAdmin || isWorkspaceOwner || isAdmin` ✅
- Page-level gates in `src/pages/CRM.tsx` and `src/pages/Deals.tsx` already block non-admins from rendering content ✅
- **Leak 1 (UI):** `src/components/layout/AppSidebar.tsx` renders the CRM icon for *every* authenticated user — there is no `show` filter on the sidebar items.
- **Leak 2 (DB):** RLS on `deals`, `deal_stages`, `deal_payments` only checks `user_has_tenant_access(tenant_id)`. Any active tenant member (Hiring Manager, recruiter, interviewer) can SELECT/INSERT/UPDATE these rows directly via the Supabase client.

## Changes

### 1. Sidebar — hide CRM for non-admins (`src/components/layout/AppSidebar.tsx`)

Add a `show` predicate to each item and filter the `items` array at render time using `usePermissions()`:

```ts
const items = [
  { id: 'home', ..., show: true },
  { id: 'crm',  ..., show: canViewOrganizations },
  { id: 'ats',  ..., show: true },
]
```

Only render items where `show === true`. No change to icon/label/route.

### 2. Database — restrict CRM tables to admin-tier users

Create a SECURITY DEFINER helper and rewrite the RLS policies on the three CRM tables. Companies (`organizations`) is intentionally **not** touched: it's shared with ATS (departments), and the Companies UI is already gated by the page-level permission check.

#### New helper

```sql
create or replace function public.user_is_crm_admin_in_tenant(_tenant_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or _tenant_id is null then return false; end if;
  return exists (
    select 1 from public.members m
    where m.user_id = v_uid
      and m.tenant_id = _tenant_id
      and m.user_status = 'active'
      and (
        m.user_type in ('platform_admin','workspace_owner')
        or (m.user_type = 'member' and m.system_role = 'admin')
      )
  );
end $$;
```

#### Replace policies on `deals`, `deal_stages`, `deal_payments`

Drop the existing `tenant select/insert/update/delete` policies and replace with admin-gated versions:

```sql
-- deals
drop policy "deals tenant select" on public.deals;
drop policy "deals tenant insert" on public.deals;
drop policy "deals tenant update" on public.deals;
drop policy "deals tenant delete" on public.deals;

create policy "deals admin select" on public.deals
  for select using (public.user_is_crm_admin_in_tenant(tenant_id));
create policy "deals admin insert" on public.deals
  for insert with check (public.user_is_crm_admin_in_tenant(tenant_id));
create policy "deals admin update" on public.deals
  for update using (public.user_is_crm_admin_in_tenant(tenant_id))
  with check (public.user_is_crm_admin_in_tenant(tenant_id));
create policy "deals admin delete" on public.deals
  for delete using (public.user_is_crm_admin_in_tenant(tenant_id));
```

Apply the same drop+recreate pattern to `deal_stages` and `deal_payments`. For `deal_payments`, the existing author-only update/delete policies are removed in favor of the admin-tier gate (recruiters/HMs were never supposed to author deal payments).

### 3. Out of scope

- No changes to `organizations` RLS (shared with ATS departments).
- No changes to the `usePermissions` matrix — already correct.
- No changes to the page-level empty-state copy in `CRM.tsx` / `Deals.tsx`.
- No changes to settings sidebar (`canViewOrganizations` already gates Deal Stages).

## Files / artifacts

- `src/components/layout/AppSidebar.tsx` (UI gate)
- One SQL migration (helper + policies on `deals`, `deal_stages`, `deal_payments`)
