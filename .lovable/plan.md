

# Log Applications and Emails in Activity Feed

## Overview

Add activity logging for three events that are currently missing from the candidate activity feed:

1. **Candidate applies** via public job posting
2. **Email received** from candidate (inbound reply)
3. Email sent is already logged -- no change needed there

## What needs to change

### 1. Add new enum value: `candidate_email_received`

The `activity_type` enum currently has `candidate_email_sent` but no `candidate_email_received`. We also need a value for applications -- `candidate_added` already exists in the enum and fits perfectly for "applied via job posting."

- **Migration**: `ALTER TYPE activity_type ADD VALUE 'candidate_email_received';`

### 2. Log activity when a candidate applies

**File**: `supabase/functions/public-submit-application/index.ts`

After the association is created (around line 385), call `log_activity` RPC:
- `p_activity_type`: `'candidate_added'`
- `p_title`: `'Applied via job posting'`
- `p_description`: `'Candidate applied for {job_title}'`
- `p_entity_type`: `'candidate'`
- `p_entity_id`: candidate ID
- `p_user_id`: use a system/service role approach (the function already uses service role client)
- `p_organization_id`: from the posting's job
- `p_tenant_id`: from the posting

Since public applications are unauthenticated, `p_user_id` will use the candidate's own ID as a reference (or a system constant). The `log_activity` RPC requires a user_id -- we'll pass a null-safe value and handle it.

### 3. Log activity when an inbound email is received

**File**: `supabase/functions/process-candidate-reply-webhook/index.ts`

After successfully inserting or updating an email_log row for a received message, call `log_activity`:
- `p_activity_type`: `'candidate_email_received'`
- `p_title`: `'Email received: {subject}'`
- `p_description`: `'Reply from {sender}'`
- `p_entity_type`: `'candidate'`
- `p_entity_id`: candidate ID
- `p_organization_id`: from the job association
- `p_tenant_id`: from the resolved tenant

This will NOT fire for internal sender copies (already filtered).

### 4. Update UI helpers to render new activity types

**File**: `src/utils/activityHelpers.tsx`

- Add `'candidate_added'` to icon map (use `UserPlus` icon, success color) -- it's actually already mapped under `candidate_created` but we should add `candidate_added` explicitly
- Add `'candidate_email_received'` to icon map (use `Mail` icon with a distinct color like `hsl(var(--info))`)

### 5. Update ActivityTimeline component (SaaS dashboard)

**File**: `src/components/saas/ActivityTimeline.tsx`

- Add `'candidate_email_received'` to the icon and color switch cases (Mail icon, cyan color -- similar to `candidate_email_sent`)

## Technical Details

### Database migration

```sql
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'candidate_email_received';
```

`candidate_added` already exists in the enum.

### Edge function changes

**public-submit-application** -- add ~15 lines after association creation to fire-and-forget `log_activity` RPC call.

**process-candidate-reply-webhook** -- add ~15 lines after successful email_log insert/update to fire-and-forget `log_activity` RPC call. Since webhook handler has no authenticated user, use the candidate_id as entity reference and a system user placeholder for p_user_id.

### Files changed

| File | Change |
|------|--------|
| `supabase/functions/public-submit-application/index.ts` | Add `log_activity` call after association creation |
| `supabase/functions/process-candidate-reply-webhook/index.ts` | Add `log_activity` call after email ingestion |
| `src/utils/activityHelpers.tsx` | Add icon/color for `candidate_added` and `candidate_email_received` |
| `src/components/saas/ActivityTimeline.tsx` | Add icon/color cases for new types |
| SQL migration | Add `candidate_email_received` to enum |

### No changes needed

- `send-user-email` already logs `candidate_email_sent` activity
- `useActivityFeed.ts` -- already generic, will pick up new types automatically
- `ActivityFeedItem.tsx` -- already generic, renders any activity type
