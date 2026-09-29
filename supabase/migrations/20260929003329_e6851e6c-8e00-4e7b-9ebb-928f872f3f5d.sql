REVOKE ALL ON FUNCTION public.job_pipeline_share_validate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_job_pipeline_share_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_job_pipeline_share_token(uuid) TO authenticated;