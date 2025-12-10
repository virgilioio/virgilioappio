-- Fix security definer views - use SECURITY INVOKER instead
DROP VIEW IF EXISTS coresignal_usage;
DROP VIEW IF EXISTS coresignal_preview_candidates;

CREATE VIEW coresignal_usage WITH (security_invoker = true) AS 
SELECT * FROM sourcing_credits_usage;

CREATE VIEW coresignal_preview_candidates WITH (security_invoker = true) AS 
SELECT * FROM sourcing_preview_candidates;