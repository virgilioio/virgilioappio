-- Fix default credit limits for coresignal_usage table
-- Change from incorrect 500/250 to trial tier values 25/10

ALTER TABLE coresignal_usage 
  ALTER COLUMN search_credits_limit SET DEFAULT 25,
  ALTER COLUMN collect_credits_limit SET DEFAULT 10;

COMMENT ON COLUMN coresignal_usage.search_credits_limit IS 
  'Monthly search credit limit (default: 25 for trial/launch tier)';
COMMENT ON COLUMN coresignal_usage.collect_credits_limit IS 
  'Monthly collect credit limit (default: 10 for trial/launch tier)';