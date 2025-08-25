-- Enhanced handle_new_user function to capture Google OAuth avatar and better name handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Log the trigger execution for debugging
  RAISE LOG 'Creating profile for new user: % with email: %', NEW.id, NEW.email;
  
  -- Use ON CONFLICT DO NOTHING to prevent duplicate profile errors
  INSERT INTO public.profiles (user_id, first_name, last_name, email, avatar_url)
  VALUES (
    NEW.id, 
    COALESCE(
      NEW.raw_user_meta_data ->> 'first_name',
      NEW.user_metadata ->> 'first_name',
      split_part(NEW.raw_user_meta_data ->> 'full_name', ' ', 1),
      split_part(NEW.user_metadata ->> 'full_name', ' ', 1)
    ), 
    COALESCE(
      NEW.raw_user_meta_data ->> 'last_name',
      NEW.user_metadata ->> 'last_name',
      split_part(NEW.raw_user_meta_data ->> 'full_name', ' ', 2),
      split_part(NEW.user_metadata ->> 'full_name', ' ', 2)
    ),
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'avatar_url',
      NEW.user_metadata ->> 'avatar_url',
      NEW.raw_user_meta_data ->> 'picture',
      NEW.user_metadata ->> 'picture'
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW; -- Don't block user creation if profile creation fails
END;
$$;

-- Backfill existing Google OAuth users with missing profile data
UPDATE public.profiles 
SET 
  first_name = COALESCE(
    first_name,
    au.raw_user_meta_data ->> 'first_name',
    au.user_metadata ->> 'first_name',
    split_part(au.raw_user_meta_data ->> 'full_name', ' ', 1),
    split_part(au.user_metadata ->> 'full_name', ' ', 1)
  ),
  last_name = COALESCE(
    last_name,
    au.raw_user_meta_data ->> 'last_name',
    au.user_metadata ->> 'last_name',
    split_part(au.raw_user_meta_data ->> 'full_name', ' ', 2),
    split_part(au.user_metadata ->> 'full_name', ' ', 2)
  ),
  avatar_url = COALESCE(
    avatar_url,
    au.raw_user_meta_data ->> 'avatar_url',
    au.user_metadata ->> 'avatar_url',
    au.raw_user_meta_data ->> 'picture',
    au.user_metadata ->> 'picture'
  ),
  updated_at = now()
FROM auth.users au
WHERE profiles.user_id = au.id
  AND (
    first_name IS NULL OR first_name = '' OR
    last_name IS NULL OR last_name = '' OR
    avatar_url IS NULL OR avatar_url = ''
  );