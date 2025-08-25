
-- 1) Drop the redundant trigger that causes duplicate profile inserts
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

-- 2) Drop the older function that's no longer needed
DROP FUNCTION IF EXISTS public.handle_new_user_profile();

-- 3) Ensure the canonical trigger points to the safe function (recreate idempotently)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
