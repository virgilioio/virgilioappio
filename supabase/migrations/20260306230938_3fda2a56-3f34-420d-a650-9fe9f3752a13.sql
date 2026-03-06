
-- One-time cleanup: touch all location fields to trigger normalization
-- Step 1: Trim whitespace and clear garbage in country
UPDATE public.candidates SET
  location_country = location_country
WHERE deleted_at IS NULL
  AND location_country IS NOT NULL;

-- Step 2: Touch state field to trigger normalization  
UPDATE public.candidates SET
  location_state = location_state
WHERE deleted_at IS NULL
  AND location_state IS NOT NULL;

-- Step 3: Touch city field to trigger normalization
UPDATE public.candidates SET
  location_city = location_city
WHERE deleted_at IS NULL
  AND location_city IS NOT NULL;
