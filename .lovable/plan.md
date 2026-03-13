

# Fix: Clean Up Ghost Blank Candidates and Prevent Recurrence

## Problem
5 blank candidate records (no name, no email, no data) and their associations were accidentally created in the Application Review stage for job `95f5e0f9-9f31-4cbf-87a6-b31a04de5366`. The original candidates in Final Candidate Review are still intact — no data was lost.

## 1. Database Cleanup (Migration)

Delete the 5 ghost associations and ghost candidate records created at `2026-03-13 18:14:40-41`:

```sql
-- Delete ghost associations
DELETE FROM job_candidate_associations 
WHERE id IN (
  '30e93eed-58f1-4e5e-99dc-98ca080f1b1e',
  'c7af2186-5fb5-4956-a2ab-187a157e77a8',
  'b42e61d3-9505-488d-9624-2840cd9eecdc',
  '711b7677-f96e-4411-892f-4df5a3ebad44',
  '821feea8-5bba-4bed-837f-ec5659724687'
);

-- Delete ghost candidates
DELETE FROM candidates 
WHERE id IN (
  '73a7237f-1712-45ab-a47f-89b43b991801',
  'ec6d722e-f53a-4444-b671-50ff82682491',
  'b9ad583a-8524-40ef-9593-b277ffe99c72',
  'd910e625-c58b-4130-8a84-1dee2d010f89',
  '03927820-4c0b-4d9f-a10c-55a68d711471'
);
```

## 2. Prevent Future Blank Candidates (Migration)

Add a database-level validation trigger on the `candidates` table that rejects inserts/updates where `candidate_name` is empty or null:

```sql
CREATE OR REPLACE FUNCTION validate_candidate_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.candidate_name IS NULL OR TRIM(NEW.candidate_name) = '' THEN
    RAISE EXCEPTION 'candidate_name cannot be empty';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_candidate_name
  BEFORE INSERT OR UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION validate_candidate_name();
```

## Files Modified
- New migration SQL (cleanup + validation trigger)

No frontend code changes needed — this is a data cleanup + database guard.

