-- Clear cache on recent sourcing project to force fresh Apollo search
UPDATE sourcing_projects 
SET sourcing_cache_expires_at = NULL 
WHERE id = '98490855-19b4-44ea-93bf-7d349f6f865f';

-- Delete cached candidates for this project
DELETE FROM sourcing_preview_candidates 
WHERE sourcing_project_id = '98490855-19b4-44ea-93bf-7d349f6f865f';