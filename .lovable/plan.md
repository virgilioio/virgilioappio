
# Plan: Enterprise-Grade Invitation Flow

## The Core Problem

Your invitation flow has a fundamental architectural gap: **the invitation token's lifecycle is tied to a specific page (`/accept-invite/:token`)**, not to the user's email address.

When users navigate away from that page (intentionally or accidentally), the connection between their email and the pending invitation is lost. They can still create an account, but the invitation is never accepted.

### What Top-Tier Apps Do Differently

**Slack, Notion, Ashby, and Greenhouse** all follow a common pattern:

1. **Email is the source of truth** - The invitation is linked to an email, not a token-bound page session
2. **Automatic reconciliation** - When a user with a pending invitation authenticates (any method), the system automatically links them to their invitation
3. **No dead ends** - Every authentication path eventually checks "does this email have a pending invitation?" and handles it

### Current vs. Enterprise Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        CURRENT ARCHITECTURE                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Invite Email ──► /accept-invite/:token ──► Create Account ──► ✓ Linked │
│       │                    │                                             │
│       │                    │ User clicks "Login" or uses Google          │
│       │                    ▼                                             │
│       │              /login or /signup ──► Create Account ──► ✗ ORPHANED │
│       │                                                                  │
│       └──────────────────────────────────────────────────────────────────┘
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                      ENTERPRISE ARCHITECTURE                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Invite Email ──► /accept-invite/:token ──► Create Account ──► ✓ Linked │
│       │                    │                                             │
│       │                    │ User clicks "Login" or uses Google          │
│       │                    ▼                                             │
│       │              /login or /signup ──► Create Account                │
│       │                                          │                       │
│       │                                          ▼                       │
│       │                                  ┌──────────────────┐            │
│       └────────────────────────────────► │  Auth Bootstrap  │            │
│                                          │  Reconciliation  │ ──► ✓ AUTO │
│                                          │     Service      │     LINKED │
│                                          └──────────────────┘            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Solution: Email-Based Invitation Reconciliation

Create a **reconciliation service** that runs after any successful authentication and automatically links users to pending invitations.

### Architecture Changes

1. **Add reconciliation to `useAuthBootstrap`** - After session is established, check if user's email has a pending invitation
2. **Create a server-side reconciliation RPC** - Atomic operation that validates and accepts pending invitations by email
3. **Remove the requirement to stay on AcceptInvite page** - Any auth path becomes valid

### Technical Implementation

**1. New RPC Function: `reconcile_pending_invitation`**

A PostgreSQL function that:
- Takes a user_id as input
- Looks up the user's email from auth.users
- Finds any pending invitation for that email
- Atomically links the user to the member record
- Returns success/failure with details

```sql
CREATE OR REPLACE FUNCTION reconcile_pending_invitation(p_user_id UUID)
RETURNS TABLE(
  success BOOLEAN,
  action_taken TEXT,
  organization_id UUID,
  organization_name TEXT,
  member_role TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
  v_member_record RECORD;
BEGIN
  -- Get user's email
  SELECT email INTO v_user_email 
  FROM auth.users 
  WHERE id = p_user_id;
  
  IF v_user_email IS NULL THEN
    RETURN QUERY SELECT false, 'user_not_found', NULL::UUID, NULL, NULL;
    RETURN;
  END IF;
  
  -- Find pending invitation for this email (with lock)
  SELECT m.*, o.name as org_name
  INTO v_member_record
  FROM members m
  JOIN organizations o ON m.organization_id = o.id
  WHERE m.invited_email = v_user_email
    AND m.user_status = 'invited'
    AND m.user_id IS NULL
    AND (m.invite_expires_at IS NULL OR m.invite_expires_at > NOW())
  FOR UPDATE OF m
  LIMIT 1;
  
  IF v_member_record IS NULL THEN
    RETURN QUERY SELECT false, 'no_pending_invitation', NULL::UUID, NULL, NULL;
    RETURN;
  END IF;
  
  -- Link the user to the member record
  UPDATE members SET
    user_id = p_user_id,
    user_status = 'active',
    invite_token = NULL,
    invite_expires_at = NULL,
    updated_at = NOW()
  WHERE id = v_member_record.id;
  
  -- Return success
  RETURN QUERY SELECT 
    true, 
    'invitation_accepted',
    v_member_record.organization_id,
    v_member_record.org_name,
    v_member_record.member_role;
END;
$$;
```

**2. Update `useAuthBootstrap.ts`**

Add reconciliation check after session is established:

```typescript
// In resolveOrgContext, after getting session:
const checkPendingInvitations = async (userId: string, email: string) => {
  try {
    const { data, error } = await supabase.rpc('reconcile_pending_invitation', {
      p_user_id: userId
    });
    
    if (data?.[0]?.success && data[0].action_taken === 'invitation_accepted') {
      log.info('🎉 Auto-linked pending invitation', {
        orgName: data[0].organization_name,
        role: data[0].member_role
      });
      
      toast({
        title: `Welcome to ${data[0].organization_name}!`,
        description: `You've been added as ${data[0].member_role.replace('_', ' ')}.`,
      });
      
      // Clear cache to force refresh with new org context
      clearOrgCache();
      return true; // Signal that context changed
    }
    return false;
  } catch (err) {
    log.warn('Invitation reconciliation check failed:', err);
    return false;
  }
};
```

**3. Update `AuthCallback.tsx`**

After successful OAuth, before redirecting:

```typescript
// After session is established:
if (session) {
  // Check for pending invitations BEFORE redirect
  const { data: reconciled } = await supabase.rpc('reconcile_pending_invitation', {
    p_user_id: session.user.id
  });
  
  if (reconciled?.[0]?.success) {
    // User was auto-linked - skip onboarding, go to dashboard
    navigate('/dashboard', { replace: true });
    return;
  }
  
  // Continue with normal flow...
}
```

**4. Update `Onboarding.tsx`**

Replace the passive "PendingInvitationAlert" with active auto-join:

```typescript
// In the pending invitation check:
if (pendingInvite) {
  // Instead of just showing an alert, try to auto-accept
  const { data: reconciled } = await supabase.rpc('reconcile_pending_invitation', {
    p_user_id: user.id
  });
  
  if (reconciled?.[0]?.success) {
    toast({
      title: `Welcome to ${reconciled[0].organization_name}!`,
      description: 'Taking you to your dashboard...',
    });
    await refreshOrgContext();
    navigate('/dashboard', { replace: true });
    return;
  }
}
```

### Benefits of This Approach

1. **Zero dead ends** - Every authentication path leads to successful invitation acceptance
2. **Idempotent** - Can be called multiple times safely
3. **Backward compatible** - AcceptInvite page still works as before
4. **OAuth-friendly** - Google auth users are automatically linked
5. **Transparent** - Users don't need to understand tokens or processes

### Files to Modify

| File | Changes |
|------|---------|
| SQL Migration | Add `reconcile_pending_invitation` RPC function |
| `src/hooks/useAuthBootstrap.ts` | Add reconciliation call after session established |
| `src/pages/AuthCallback.tsx` | Check and reconcile before redirect |
| `src/pages/Onboarding.tsx` | Auto-accept instead of showing alert |
| `src/pages/AccountSetup.tsx` | Add reconciliation check (optional) |

### Immediate Fix for Existing Users

For `creclutamiento@aquamatic.com.mx` and any other orphaned users, the new RPC can be called manually or you can run this SQL directly:

```sql
-- Link the existing user to their pending invitation
UPDATE members 
SET 
  user_id = 'ca6e46b4-3887-4175-8683-749665f43142',
  user_status = 'active',
  invite_token = NULL,
  invite_expires_at = NULL,
  updated_at = NOW()
WHERE invited_email = 'creclutamiento@aquamatic.com.mx'
  AND user_status = 'invited'
  AND user_id IS NULL;
```

### Testing Checklist

1. **New user via AcceptInvite page** - Should still work as before
2. **New user via Google OAuth after clicking invite** - Auto-linked
3. **New user signs up via /signup, then logs in** - Auto-linked on login
4. **Existing orphaned users** - Auto-linked on next login
5. **Expired invitations** - Should NOT be auto-linked
6. **User with no pending invitation** - No side effects
