-- Phase 1: Backfill missing profile emails from auth.users
UPDATE public.profiles 
SET email = auth_users.email,
    updated_at = now()
FROM auth.users auth_users
WHERE profiles.user_id = auth_users.id 
  AND (profiles.email IS NULL OR profiles.email = '');

-- Verify and enhance the handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Log the trigger execution for debugging
  RAISE LOG 'Creating profile for new user: % with email: %', NEW.id, NEW.email;
  
  INSERT INTO public.profiles (user_id, first_name, last_name, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.email
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW; -- Don't block user creation if profile creation fails
END;
$$;

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();