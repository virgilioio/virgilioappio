-- Create whoami RPC function for server identity verification
CREATE OR REPLACE FUNCTION public.whoami()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid();
$$;