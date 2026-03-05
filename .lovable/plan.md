

# Offer Approval Chain Configuration

## What We're Building

A new "Offer Approval Chain" section in **Job Setup > Hiring Team** where admin users (platform admins, workspace owners, admins) can configure an ordered list of offer approvers for a job. Configuration only — no approval workflow execution.

## Database Migration

**Table 1: `offer_approval_chains`** (one per job)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| job_id | uuid FK → jobs | unique, cascade delete |
| organization_id | uuid FK → organizations | tenant scoping |
| is_enabled | boolean | default false |
| created_by | uuid | who configured it |
| created_at / updated_at | timestamptz | defaults now() |

**Table 2: `offer_approval_chain_steps`** (ordered approvers)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| chain_id | uuid FK → offer_approval_chains | cascade delete |
| approver_user_id | uuid | references profiles(user_id) |
| step_order | integer | 1, 2, 3... |
| created_at | timestamptz | |

Unique constraints: `(chain_id, step_order)` and `(chain_id, approver_user_id)`.

**RLS Policies:**
- SELECT: `check_org_hierarchy_role_access(organization_id, 'recruiter')` — recruiters+ can view the chain config
- INSERT/UPDATE/DELETE: `check_org_hierarchy_role_access(organization_id, 'admin')` — admins only can configure
- For steps: join to chain table to get `organization_id` for the same access pattern

## New Files

**`src/hooks/useOfferApprovalChain.ts`**
- `useOfferApprovalChain(jobId)` — fetches chain + steps with approver profile info (name, email)
- Mutations: `toggleChain`, `addApprover`, `removeApprover`, `reorderApprover` (swap step_order up/down)
- Uses react-query with invalidation on mutations

**`src/components/jobs/OfferApprovalChainConfig.tsx`**
- Permission-gated: only renders config controls for admins (platform admin, workspace owner, admin role). Others see read-only view or nothing.
- Switch toggle: "Enable offer approval for this job"
- When enabled: ordered list of approvers with step numbers
- "Add Approver" dropdown using `SearchableSelect` filtered to org members (admin/recruiter roles — same `useMembers` pattern as `JobAssignmentsPanel`)
- Each row: step number, approver name, role badge, up/down arrows, remove button
- Auto-saves on each action

## Modified Files

**`src/components/jobs/HiringTeamTab.tsx`**
- Import and render `OfferApprovalChainConfig` below the existing `JobAssignmentsPanel`, passing `jobId` and `jobTitle`

