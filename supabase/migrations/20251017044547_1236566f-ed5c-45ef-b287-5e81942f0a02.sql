-- Allocate trial credits to all existing organizations without credits
INSERT INTO public.org_credit_usage (
  organization_id,
  search_limit,
  search_remaining,
  collect_limit,
  collect_remaining,
  last_refill_at,
  next_refill_at
)
SELECT 
  o.id,
  10,  -- trial search limit
  10,  -- starts full
  5,   -- trial collect limit
  5,   -- starts full
  now(),
  now() + interval '30 days'
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.org_credit_usage WHERE organization_id = o.id
)
ON CONFLICT (organization_id) DO NOTHING;