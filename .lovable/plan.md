

# Fix: Request Approval button not visible after recall

## Root Cause

The "Request Approval" button visibility condition requires `!approvalRequest` (null). After a recall, the `offer_approval_requests` row remains in the DB with `status: 'recalled'`. The query fetches it via `.maybeSingle()` without filtering by status, so `approvalRequest` is truthy and the button stays hidden.

## Fix

**`src/hooks/useOfferApprovalRequest.ts`** -- Update the query to only return **active** approval requests (status `pending` or `approved`). Add a `.in('status', ['pending', 'approved'])` filter to the Supabase query so recalled and declined requests are ignored.

This single-line filter change makes `approvalRequest` return `null` for recalled/declined requests, which satisfies the `!approvalRequest` condition and shows the "Request Approval" button again.

No other files need changes.

