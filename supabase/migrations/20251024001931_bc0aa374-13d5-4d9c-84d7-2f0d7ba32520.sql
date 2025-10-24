-- Phase 2: Drop Sourcing Database Functions
-- Remove unused RPC functions related to sourcing credits

-- Drop sourcing credit management functions
DROP FUNCTION IF EXISTS public.consume_sourcing_credits(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.refill_org_sourcing_credits(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_org_credits(UUID);

-- Log the cleanup
DO $$
BEGIN
  RAISE NOTICE 'Sourcing RPC functions dropped successfully:';
  RAISE NOTICE '  - consume_sourcing_credits(UUID, TEXT, INTEGER)';
  RAISE NOTICE '  - refill_org_sourcing_credits(UUID, INTEGER, INTEGER)';
  RAISE NOTICE '  - get_org_credits(UUID)';
END $$;