-- Delete all data for test user chrome-reviewer@virgilio.tech
-- User ID: fca50f8e-95f0-4e5a-8300-491b94f6e857

-- Delete profile (if exists)
DELETE FROM profiles WHERE user_id = 'fca50f8e-95f0-4e5a-8300-491b94f6e857';

-- Delete from auth.users (this cascades to related auth tables)
DELETE FROM auth.users WHERE id = 'fca50f8e-95f0-4e5a-8300-491b94f6e857';