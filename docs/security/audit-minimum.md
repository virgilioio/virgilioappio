# Minimal Audit Trails - Security Documentation

## Overview

This document describes the minimal audit trail implementation for sensitive operations in the Virgilio ATS platform. Audit logs capture critical security and compliance events without impacting system performance.

## Events Captured

### 1. Member Role Changes
- **Event Type**: `member_role_changed`
- **Trigger**: Automatic (database trigger)
- **When**: Any update to `members.member_role`
- **Captured Data**:
  - Old role
  - New role
  - User ID
  - Organization ID
  - Changed by (actor)

### 2. Invitation Acceptances
- **Event Type**: `invitation_accepted`
- **Trigger**: Edge function call
- **When**: User successfully accepts team invitation
- **Captured Data**:
  - Member ID
  - User type assigned
  - Member role assigned
  - Organization ID
  - New user ID

### 3. File Downloads
- **Event Type**: `attachment_downloaded`
- **Trigger**: Edge function call
- **When**: User downloads candidate attachment via `download-attachment` function
- **Captured Data**:
  - Attachment ID
  - File name
  - File type
  - Downloaded by (user ID)
  - Download timestamp

### 4. Offer Letter Status Changes
- **Event Type**: `offer_letter_status_changed`
- **Trigger**: Automatic (database trigger)
- **When**: Any update to `offer_letters.status`
- **Captured Data**:
  - Old status
  - New status
  - Candidate ID
  - Job ID
  - Organization ID
  - Changed by (actor)

## Database Schema

### audit_logs Table
```sql
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,              -- Event type (e.g., 'member_role_changed')
  table_name TEXT,                   -- Source table if applicable
  record_id UUID,                    -- ID of affected record
  user_id UUID,                      -- Actor (who performed the action)
  old_values JSONB,                  -- Previous state
  new_values JSONB,                  -- New state
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Indexes
- `idx_audit_logs_action` - Fast filtering by event type
- `idx_audit_logs_created_at` - Chronological queries (DESC)
- `idx_audit_logs_user_id` - Find all actions by user
- `idx_audit_logs_table_record` - Composite index for record lookups

## Implementation Details

### Database Triggers
Created in migration: `20250116_audit_trails.sql`

**Functions:**
- `public.log_audit_event()` - Helper for programmatic logging
- `public.audit_member_role_change()` - Trigger function for member role changes
- `public.audit_offer_letter_status_change()` - Trigger function for offer status changes

**Triggers:**
- `trigger_audit_member_role_change` - AFTER UPDATE on `members`
- `trigger_audit_offer_letter_status_change` - AFTER UPDATE on `offer_letters`

### Edge Functions
Modified to include audit logging:

1. **accept-invitation-with-metadata/index.ts**
   - Logs after successful invitation acceptance
   - Non-blocking (errors don't fail the invitation process)

2. **download-attachment/index.ts**
   - Logs after successful file download
   - Non-blocking (errors don't fail the download)

### Client Library
**Location**: `src/lib/audit.ts`

Provides `logAuditEvent()` helper for consistent audit logging from client or edge contexts.

## Querying Audit Logs

### Last 50 Events (All Types)
```sql
SELECT 
  created_at,
  action,
  table_name,
  user_id,
  old_values,
  new_values
FROM public.audit_logs
ORDER BY created_at DESC
LIMIT 50;
```

### Role Changes Only
```sql
SELECT 
  created_at,
  user_id AS changed_by,
  old_values->>'member_role' AS old_role,
  new_values->>'member_role' AS new_role,
  new_values->>'organization_id' AS organization_id
FROM public.audit_logs
WHERE action = 'member_role_changed'
ORDER BY created_at DESC;
```

### Invitation Acceptances
```sql
SELECT 
  created_at,
  user_id AS new_user_id,
  new_values->>'member_role' AS assigned_role,
  new_values->>'organization_id' AS organization_id
FROM public.audit_logs
WHERE action = 'invitation_accepted'
ORDER BY created_at DESC;
```

### File Downloads by User
```sql
SELECT 
  created_at,
  new_values->>'file_name' AS file_name,
  new_values->>'file_type' AS file_type,
  record_id AS attachment_id
FROM public.audit_logs
WHERE action = 'attachment_downloaded'
  AND user_id = '<user-uuid-here>'
ORDER BY created_at DESC;
```

### Offer Letter Status Timeline
```sql
SELECT 
  created_at,
  record_id AS offer_letter_id,
  old_values->>'status' AS old_status,
  new_values->>'status' AS new_status,
  user_id AS changed_by
FROM public.audit_logs
WHERE action = 'offer_letter_status_changed'
  AND record_id = '<offer-letter-uuid-here>'
ORDER BY created_at ASC;
```

## Retention and Compliance

### Current Configuration
- **Retention**: Indefinite (no automatic cleanup)
- **Storage**: PostgreSQL JSONB (efficient, indexed)
- **Performance**: Minimal impact (indexed, non-blocking)

### Future Considerations
- Archive logs older than 2 years
- Export to cold storage for long-term compliance
- Implement retention policies per regulation requirements (GDPR, SOC2, etc.)

## Security Considerations

### Access Control
Current RLS policy on `audit_logs`:
- **Platform admins**: Full read access
- **Regular users**: No direct access (prevents tampering)

### Data Protection
- User IDs are UUIDs (no PII)
- JSONB values may contain sensitive data - review before exposing
- Consider encryption at rest for highly sensitive audit data

## Testing Audit Trails

### 1. Test Member Role Change
```sql
-- As authenticated user, update a member role
UPDATE public.members 
SET member_role = 'admin' 
WHERE id = '<member-id>';

-- Verify audit log created
SELECT * FROM public.audit_logs 
WHERE action = 'member_role_changed' 
ORDER BY created_at DESC LIMIT 1;
```

### 2. Test Invitation Acceptance
- Accept an invitation via the normal flow
- Check audit logs for `invitation_accepted` event
- Verify `new_values` contains correct user and role data

### 3. Test File Download
- Download a candidate attachment
- Check audit logs for `attachment_downloaded` event
- Verify requester's `user_id` is logged

### 4. Test Offer Letter Status
```sql
-- Update offer letter status
UPDATE public.offer_letters 
SET status = 'sent' 
WHERE id = '<offer-letter-id>';

-- Verify audit log
SELECT * FROM public.audit_logs 
WHERE action = 'offer_letter_status_changed' 
ORDER BY created_at DESC LIMIT 1;
```

## Troubleshooting

### Audit Logs Not Created
1. **Check triggers are enabled**:
   ```sql
   SELECT tgname, tgenabled 
   FROM pg_trigger 
   WHERE tgname LIKE 'trigger_audit%';
   ```
   
2. **Verify functions exist**:
   ```sql
   SELECT proname 
   FROM pg_proc 
   WHERE proname LIKE 'audit_%';
   ```

3. **Check for errors in edge function logs** (Supabase Dashboard → Functions)

### Performance Issues
- Verify indexes exist: `\d+ audit_logs`
- Check JSONB query patterns (use GIN indexes if needed)
- Monitor table size: `SELECT pg_size_pretty(pg_total_relation_size('audit_logs'));`

### Missing User Context
- Edge function logs: Ensure JWT token is passed correctly
- Trigger logs: `auth.uid()` may be NULL for service role operations (expected)

## Related Documentation
- [Supabase Audit Logging Guide](https://supabase.com/docs/guides/database/audit)
- [Function Search Path Audit](./function-search-path-audit.md)
- [Sentry Setup](../operations/sentry-setup.md)
