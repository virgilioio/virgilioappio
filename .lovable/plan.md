
## Root Cause: Missing NULL Guard on the Attachment Upload Activity Trigger

The file upload IS working (the PDF gets stored in the `candidate-attachments` bucket successfully), but the `candidate_attachments` database record fails to save, causing a rollback that also deletes the file from storage. The result: **the resume is not being saved** for public applicants.

### What Happens Step by Step

1. Edge function uploads file to `candidate-attachments` storage bucket — **succeeds**
2. Edge function inserts a row into `candidate_attachments` table with `uploaded_by: null`
3. Database trigger `trg_log_attachment_uploaded` fires (`log_candidate_attachment_uploaded`)
4. The trigger calls `log_activity(p_user_id := NEW.uploaded_by, ...)` — passes **null** as user_id
5. `log_activity()` does `INSERT INTO activities (user_id, ...)` — hits the NOT NULL constraint
6. **PostgreSQL error 23502** — entire `candidate_attachments` INSERT transaction rolls back
7. Edge function catches the `dbError`, then deletes the file from storage as cleanup
8. Edge function returns the upload as "failed" with the `Database error: null value in column "user_id"` message

So yes — the resume is genuinely **not being saved**. The error toast is accurate.

### Why This Wasn't Caught Earlier

Previous fixes applied NULL guards to these trigger functions:
- `log_candidate_job_assignment`
- `log_candidate_stage_activity`
- `log_candidate_status_change`
- `log_candidate_updated`

But `log_candidate_attachment_uploaded` was created in a separate migration (`20251125052732`) and was never given the same guard. The pattern was missed.

### The Fix

A single SQL migration adding the same NULL guard pattern to `log_candidate_attachment_uploaded`:

```sql
CREATE OR REPLACE FUNCTION public.log_candidate_attachment_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_candidate_name TEXT;
  v_organization_id UUID;
BEGIN
  -- Skip activity logging for unauthenticated/service-role operations
  -- (e.g., public job application submissions where uploaded_by is null)
  IF NEW.uploaded_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get candidate name and organization
  SELECT c.candidate_name, c.organization_id 
  INTO v_candidate_name, v_organization_id
  FROM public.candidates c 
  WHERE c.id = NEW.candidate_id;
  
  -- Log the activity
  PERFORM public.log_activity(
    p_user_id := NEW.uploaded_by,
    p_organization_id := v_organization_id,
    p_activity_type := 'candidate_attachment_uploaded',
    ...
  );
  
  RETURN NEW;
END;
$$;
```

### Files Changed

- **One database migration only** — `CREATE OR REPLACE FUNCTION public.log_candidate_attachment_uploaded()` with the NULL guard added at the top. No edge function changes, no frontend changes.

### Impact

After this fix:
- Public applicants' resumes will save correctly to both storage and the database
- The "Some files failed to upload" error toast will no longer appear
- Activity logging for internal uploads (where `uploaded_by` is a real user ID) continues to work exactly as before — the guard only skips logging when null
