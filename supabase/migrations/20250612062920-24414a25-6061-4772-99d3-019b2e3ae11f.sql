
-- Add foreign key constraint between members.user_id and profiles.user_id
ALTER TABLE public.members 
ADD CONSTRAINT fk_members_user_profiles 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- Also ensure profiles.user_id has the proper foreign key to auth.users if not already set
-- (This might already exist, but we'll make sure)
DO $$ 
BEGIN
    -- Check if the foreign key constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_user_id_fkey' 
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) 
        ON DELETE CASCADE;
    END IF;
END $$;
