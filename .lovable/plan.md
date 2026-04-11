

# Fix: Workspace Creation Error ("Hunting Happiness" Customer)

## Root Cause

**Line 406 of `supabase/functions/provision-tenant/index.ts`** references `trialEnd` — a variable that **does not exist**. The actual variable is `trialEndsAt` (defined on line 349), and only within an inner `else` block.

When the function reaches the success response (line 401-409), `trialEnd` throws a **ReferenceError** in Deno's strict mode. This is caught by the catch block and returned as a 500 error.

### What the customer experienced:
1. Typed "Hunting Happiness" as workspace name, clicked Create
2. The function **successfully** created the tenant, organization, member, and subscription
3. But then **crashed** trying to serialize the response because of the undefined `trialEnd` variable
4. Frontend received a 500 → showed error toast
5. On hard refresh, the **idempotency check** (lines 76-98) found the existing active membership and returned 200 → everything worked

The workspace name "Hunting Happiness" appeared in the error context because it was part of the failed function's logs/payload.

## Fix

In `supabase/functions/provision-tenant/index.ts`, line 406: remove `trialEnd` from the response (the frontend doesn't use it — line 72 of Onboarding.tsx only reads `workspaceId`).

```typescript
// Before (line 401-409):
return new Response(
  JSON.stringify({ 
    status: "ok", 
    workspaceId: tenantId,
    tenantId,
    trialEnd         // ← ReferenceError: not defined
  }),
  ...
);

// After:
return new Response(
  JSON.stringify({ 
    status: "ok", 
    workspaceId: tenantId,
    tenantId,
  }),
  ...
);
```

## Files changed

| File | Change |
|------|--------|
| `supabase/functions/provision-tenant/index.ts` | Remove undefined `trialEnd` from success response (line 406) |

