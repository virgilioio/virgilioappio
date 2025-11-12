-- Delete stuck users to allow fresh signup attempts
-- These users exist in auth.users but have no member/tenant records

DELETE FROM auth.users 
WHERE email IN ('javier@fortvna.club', 'allan.bravo@gomotive.com');

-- Log the cleanup
DO $$
BEGIN
  RAISE NOTICE 'Deleted stuck users: javier@fortvna.club, allan.bravo@gomotive.com';
  RAISE NOTICE 'Users can now sign up fresh and the provision-tenant flow will be tested';
END $$;