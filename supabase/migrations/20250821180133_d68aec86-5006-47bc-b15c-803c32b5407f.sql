-- Fix the handle_new_user function to prevent duplicate profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  -- Log the trigger execution for debugging
  RAISE LOG 'Creating profile for new user: % with email: %', NEW.id, NEW.email;
  
  -- Use ON CONFLICT DO NOTHING to prevent duplicate profile errors
  INSERT INTO public.profiles (user_id, first_name, last_name, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name', 
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW; -- Don't block user creation if profile creation fails
END;
$function$;