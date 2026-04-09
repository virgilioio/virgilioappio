-- Re-grant SELECT on profiles to anon role
-- The existing RLS policy "Public can view profiles for active booking configs"
-- already restricts access to only users with active booking configurations
GRANT SELECT ON public.profiles TO anon;