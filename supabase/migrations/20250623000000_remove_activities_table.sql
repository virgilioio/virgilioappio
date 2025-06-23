
-- Drop the activities table and all related objects

-- Drop RLS policies first
DROP POLICY IF EXISTS "activities_view_own_or_admin" ON public.activities;
DROP POLICY IF EXISTS "activities_insert_own" ON public.activities;
DROP POLICY IF EXISTS "activities_update_own_or_admin" ON public.activities;
DROP POLICY IF EXISTS "activities_delete_own_or_admin" ON public.activities;
DROP POLICY IF EXISTS "Users can view activities in their organization" ON public.activities;
DROP POLICY IF EXISTS "Users can create activities" ON public.activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON public.activities;

-- Drop the table
DROP TABLE IF EXISTS public.activities;

-- Drop the enum type
DROP TYPE IF EXISTS public.activity_type;

-- Drop the function
DROP FUNCTION IF EXISTS public.handle_activities_updated_at();

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'Successfully removed activities table and related objects.';
END $$;
