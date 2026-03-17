DROP POLICY IF EXISTS "scorecards_update_24h_window" ON public.job_stage_scorecards;

CREATE POLICY "Users can update their own scorecards"
ON public.job_stage_scorecards
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR is_platform_admin())
WITH CHECK (created_by = auth.uid() OR is_platform_admin());