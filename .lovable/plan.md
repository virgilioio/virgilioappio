

# Wire Up Workspace Confirmation Email Automation (End-to-End)

## Overview

Currently, the Confirmation Email Automation UI is a front-end-only mockup -- toggling it on does nothing. We need to build a proper backend pipeline so that when a candidate submits a public application, and the workspace has this automation enabled, a confirmation email is sent via the recruiter's connected Gmail identity (same `send-user-email` infrastructure used everywhere else).

We'll design a **generic workspace automations table** that can be reused for future automation types (applicant notifications, interview reminders, stage alerts, etc.).

---

## Architecture

```text
Candidate submits application
        |
        v
public-submit-application (edge function)
        |
        v
Check: workspace_automations table
  - type = 'application_confirmation_email'
  - is_active = true
  - scoped to tenant
        |
        v (if active)
Resolve placeholders (candidate, job, org)
        |
        v
Call send-user-email (service role)
  - from_email = automation config's from_email
  - to = [candidate.email]
```

---

## Step 1: Create `workspace_automations` table

A generic, future-proof table for all workspace-level automations:

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK tenants | Scoped to workspace |
| automation_type | text | e.g. `application_confirmation_email` |
| is_active | boolean | Toggle on/off |
| subject | text | Email subject template (with placeholders) |
| body | text | Email body template (with placeholders) |
| from_email | text | Connected mail identity email |
| config | jsonb | Future-proof extensible config (e.g. conditions, filters) |
| created_by | uuid FK auth.users | |
| created_at / updated_at | timestamptz | |
| UNIQUE(tenant_id, automation_type) | | One config per type per workspace |

RLS policies:
- SELECT/INSERT/UPDATE/DELETE for authenticated members of the tenant (via membership check)

---

## Step 2: Update `ConfirmationEmailAutomation.tsx`

- Add a "From Email" selector using connected mail identities (same pattern as stage automations)
- Load/save automation config from `workspace_automations` table
- Create a `useWorkspaceAutomation` hook that:
  - Fetches the automation row for `application_confirmation_email` + current tenant
  - Provides `save` and `toggle` mutations
- On toggle enable: upsert the row with `is_active = true`
- On toggle disable: update `is_active = false`
- On subject/body/from_email change: debounced save or explicit "Save" button

---

## Step 3: Create `useWorkspaceAutomation` hook

A reusable hook (not just for confirmation email) that accepts an `automation_type` string:

```typescript
useWorkspaceAutomation('application_confirmation_email')
// Returns: { automation, isLoading, save, toggle }
```

This hook will be reusable for future automation types (applicant notifications, stage alerts, etc.).

---

## Step 4: Update `public-submit-application` edge function

After the application is successfully processed (candidate created, association created, files uploaded), add a fire-and-forget block:

1. Query `workspace_automations` for `tenant_id` + `automation_type = 'application_confirmation_email'` + `is_active = true`
2. If found, resolve placeholders in subject/body using candidate data + job data
3. Call `send-user-email` via `supabase.functions.invoke()` with service role auth, passing:
   - `from_email` from the automation config
   - `to: [candidate.email]`
   - `subject` and `body_html` with resolved placeholders
   - `candidate_id` and `job_id` for email logging

This is fire-and-forget (non-blocking) -- a failed confirmation email should never block the application itself.

---

## Step 5: Add `organization.name` placeholder resolution

The `send-user-email` function already resolves `candidate.*`, `job.*`, and `sender.*` placeholders. For confirmation emails, `organization.name` is used in the default template. The `public-submit-application` function already has access to the organization via the job posting. We'll pass the org name as part of the email body after resolving it inline before calling `send-user-email`, since the caller has all the context needed.

---

## Files to create
- `src/hooks/useWorkspaceAutomation.ts` -- generic reusable hook

## Files to modify
- `src/components/settings/automations/ConfirmationEmailAutomation.tsx` -- wire to DB, add from_email selector
- `supabase/functions/public-submit-application/index.ts` -- trigger confirmation email after successful application

## Database migration
- Create `workspace_automations` table with RLS policies

---

## What this enables for the future
- Any new automation type just needs a new `automation_type` value and a UI component
- The `useWorkspaceAutomation` hook works for any type out of the box
- The `workspace_automations` table's `config` JSONB column allows type-specific settings without schema changes
- The same `send-user-email` infrastructure handles delivery, logging, and tracking

