

# Fix: Unique constraint violation on re-requesting approval

## Problem

The `offer_approval_requests` table has a unique constraint `UNIQUE (offer_letter_id)` which prevents creating a new approval request for the same offer letter, even after the previous request was recalled. The recalled row remains in the table, blocking the insert.

## Solution

Replace the blanket unique constraint with a **partial unique index** that only enforces uniqueness for active requests (status `pending` or `approved`). This allows recalled/declined rows to coexist with a new active request.

### Database Migration

```sql
-- Drop the existing blanket unique constraint
ALTER TABLE offer_approval_requests 
  DROP CONSTRAINT offer_approval_requests_offer_letter_unique;

-- Create a partial unique index for active requests only
CREATE UNIQUE INDEX offer_approval_requests_active_unique 
  ON offer_approval_requests (offer_letter_id) 
  WHERE status IN ('pending', 'approved');
```

No code changes needed -- the existing query filter and insert logic already handle statuses correctly.

