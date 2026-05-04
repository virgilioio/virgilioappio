UPDATE public.booking_configurations bc
SET timezone = p.timezone
FROM public.profiles p, public.calendar_identities ci
WHERE bc.user_id = p.user_id
  AND ci.user_id = bc.user_id
  AND ci.is_active = true
  AND (bc.timezone IS NULL OR bc.timezone = 'UTC')
  AND p.timezone IS NOT NULL
  AND p.timezone <> 'UTC';