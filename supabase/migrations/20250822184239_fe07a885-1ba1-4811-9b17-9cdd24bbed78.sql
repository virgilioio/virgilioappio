-- Clean up stale invitation for luna@virgilio.tech
DELETE FROM public.members 
WHERE id = '8202dc18-d679-40dc-9096-0cd152ae7475' 
  AND invited_email = 'luna@virgilio.tech' 
  AND user_status = 'invited';