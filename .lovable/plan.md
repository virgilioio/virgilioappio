# Departments as a first-class concept

## Today (the mess we want to fix)

- `organizations` is overloaded. Sub-orgs under a tenant are called "Departments" in the UI but they are really **Clients** (Arqademy, etc.). `jobs.organization_id` points to a client org.
- `jobs.department` exists as a free-text column, currently shown on the public careers page and in `JobHero`, but it isn't editable in the wizard and isn't backed by any real catalog.
- Net effect: there is no real way to say "this is a Sales role at Arqademy" vs "this is a Finance role at Arqademy."

## Target model

- **Client** = the existing `organizations` row (kept as-is). Required on a job.
- **Department** = a new, workspace-wide catalog (Sales, People, Finance, Engineering…), shared across all clients in the tenant. Required on a job.
- Job picks **Client + Department** independently. One client can have jobs across many departments; one department can span many clients.

## Database

New table `public.departments`:

- `id uuid pk`
- `tenant_id uuid not null` → `organizations(id)` (the tenant root)
- `name text not null`
- `slug text not null` (lowercased, for URLs/grouping on careers page)
- `description text null`
- `color text null` (optional, for chips later)
- `is_archived bool default false`
- `created_by`, `created_at`, `updated_at`
- Unique `(tenant_id, lower(name))` and `(tenant_id, slug)`
- GRANTs for `authenticated` + `service_role`; RLS via `user_has_tenant_access(tenant_id)` for read, and tenant-admin/owner check for write
- Seed each existing tenant with: Engineering, Product, Design, Sales, Marketing, People, Finance, Operations, Customer Success, General (the last as a safe default)

Add to `public.jobs`:

- `department_id uuid null` → `departments(id) on delete set null`
- Index on `(tenant_id, department_id)`

**Existing data handling (your "Arqademy shouldn't be a department" point):**

- We do **not** copy client names into departments.
- We do **not** try to guess departments from the free-text `jobs.department` column.
- All existing jobs get `department_id = <tenant's "General" department>` in the same migration.
- Keep `jobs.department` column for now as a denormalized display cache (written from `departments.name` on save). We can drop it in a later cleanup migration once nothing reads it.

## Settings UI — manage Departments

New tab: **Settings → Workspace → Departments** (admin/owner only).

- Table of departments (name, # of open jobs, # of total jobs, archived flag).
- Create / rename / archive (no hard-delete if jobs reference it; archive instead).
- Cannot archive "General" (acts as fallback).
- Inline create from the job wizard via `+ Create department` (mirrors today's `+ Create Department` affordance, but it really creates a department now, not a client org).

## Job creation & editing

`src/components/jobs/wizard/JobInfoStep.tsx`:

- Split the current single field into **two** required `SearchableSelect`s, side by side:
  - **Client** (label change from "Department / Organization" → "Client"). Source: `useChildOrganizationsForJobCreation`. `+ Create client` opens the existing `OrganizationFormSheet`.
  - **Department**. Source: new `useDepartments()` hook. `+ Create department` opens a small inline create dialog.
- Validation in `JobWizard.tsx`: `canProceed` now requires `organization_id` **and** `department_id`.
- `JobFormSheet.tsx` (quick-create + edit): same two-field treatment.
- On save, also write `jobs.department = <selected department.name>` so legacy reads keep working without a join.

## Display surfaces

All currently say "department" but read either `organization.name` or the free-text column. Update to prefer `department.name`:

- `src/components/jobs/JobHero.tsx` — already takes a `department` prop. Pass department name; show client name separately as a small secondary line ("Acme · Sales").
- `src/components/jobs/JobOverviewTab.tsx` — currently falls back `organization_name || department`. Change to show **Department** and **Client** as two distinct fields.
- `src/components/jobs/wizard/SummaryStep.tsx` — same split.
- Jobs list / filters (`src/components/pipeline/FilterCard.tsx`, `JobPostingStep.tsx` search) — add a Department filter chip alongside the existing Department-as-client behaviour. Existing client filter stays.

## Public careers + job posting

- `src/pages/PublicCareersPage.tsx` + `CareersRoleList.tsx` — already group by `department` text. Switch source to `department.name` (via the denormalized column or join). Grouping/filtering UX is unchanged.
- `src/pages/PublicJobPosting.tsx` + `JobHeader.tsx` — show Department in the meta row exactly as today; nothing else changes.
- Filter bar `CareersFilterBar.tsx` — keep "Department" filter; just sourced from the real department list now.

## Out of scope (call out so we don't sneak it in)

- No changes to billing, tenant model, RLS hierarchy, or `org_kind`.
- No per-client department restriction (workspace-wide, per your answer).
- No automation/scorecard/offer scoping by department (departments are descriptive, not access-controlling). Can revisit later.
- No bulk re-tagging UI for existing jobs in this pass — admins do it manually from the job edit form. The "General" backfill keeps everything valid in the meantime.

## Risks / things to watch

- The word "Department" is plastered across the codebase pointing at the wrong thing (orgs). The rename in the wizard ("Client" vs "Department") is the most error-prone part — must audit `JobInfoStep`, `SummaryStep`, `JobFormSheet`, `CreateJobFromProjectDialog`, `JobOverviewTab` together in one pass.
- `useChildOrganizationsForJobCreation` and `OrganizationFormSheet` strings (toast says "department created") — update copy to "client".
- Memory entry `Default department structure` (auto-create "General" org during provisioning) becomes misleading. Update that memory after the migration so future agents don't confuse the two concepts.

## Rollout order

1. Migration: create `departments`, seed per-tenant, add `jobs.department_id`, backfill to "General".
2. Hooks: `useDepartments`, `useCreateDepartment`.
3. Settings → Departments tab.
4. Wizard + JobFormSheet: dual selectors + validation.
5. Display surfaces: JobHero, JobOverviewTab, SummaryStep, public careers/job pages.
6. Copy cleanup on the Client (formerly "Department / Organization") flow.
7. Memory update.
