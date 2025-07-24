-- Update existing workers to use Worker Compliance country names
-- Map common country variations to Worker Compliance country names

UPDATE workers 
SET country = 'México'
WHERE country = 'Mexico';

-- Add any other common country mappings if needed
UPDATE workers 
SET country = 'United States'
WHERE country IN ('USA', 'US', 'United States of America');

UPDATE workers 
SET country = 'United Kingdom'
WHERE country IN ('UK', 'Great Britain', 'England');

-- You can add more mappings as needed for other countries