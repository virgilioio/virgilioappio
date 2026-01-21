-- Enable Row Level Security on the failed_job_board_applications table
ALTER TABLE public.failed_job_board_applications ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view failed applications (for debugging)
CREATE POLICY "Platform admins can view failed applications"
ON public.failed_job_board_applications
FOR SELECT
USING (get_user_type_secure() = 'platform_admin');

-- Platform admins can manage failed applications (update resolved status, delete old records)
CREATE POLICY "Platform admins can manage failed applications"
ON public.failed_job_board_applications
FOR ALL
USING (get_user_type_secure() = 'platform_admin');