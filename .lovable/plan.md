

# Fix: Reorder Approvers Failing Due to Unique Constraint

## Root Cause

The `offer_approval_chain_steps` table has a **unique constraint** on `(chain_id, step_order)`. The current reorder mutation updates steps one-by-one in a loop, which causes a conflict — e.g., when swapping steps 1 and 2, setting step 1 to order 2 fails because step 2 still holds that value.

## Fix

**`src/hooks/useOfferApprovalChain.ts`** — Change the `reorderStepsMutation` to first set all step orders to large temporary values (e.g., `1000 + i`) in one pass, then set them to the correct final values in a second pass. This avoids hitting the unique constraint at any point.

Alternatively (and more cleanly), use a single raw SQL call via an RPC function, but the two-pass approach requires no schema changes and is the quickest fix.

**Single file change, ~6 lines modified.**

