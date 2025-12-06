-- Enable DELETE policy for job_stage_scorecards
-- Users can delete their own scorecards at any time
CREATE POLICY "Users can delete their own scorecards"
ON job_stage_scorecards
FOR DELETE
USING (
  (created_by = auth.uid()) 
  OR is_platform_admin()
);