-- Clean up duplicate coresignal_usage records
-- Keep only the most recent record per tenant based on updated_at

DELETE FROM coresignal_usage
WHERE id IN (
  SELECT id 
  FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY updated_at DESC) as rn
    FROM coresignal_usage
  ) sub
  WHERE rn > 1
);

-- Add comment for audit trail
COMMENT ON TABLE coresignal_usage IS 'Tracks CoreSignal API usage per tenant. One active record per tenant. Cleaned duplicates on 2025-01-21.';