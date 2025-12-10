-- Clear ALL sourcing project caches to force fresh Apollo searches
UPDATE sourcing_projects 
SET sourcing_cache_expires_at = NULL;

-- Clear ALL cached preview candidates
DELETE FROM sourcing_preview_candidates;