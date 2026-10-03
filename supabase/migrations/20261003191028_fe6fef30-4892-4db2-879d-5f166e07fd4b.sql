ALTER FUNCTION public.mark_hired(uuid, uuid, date, boolean) SECURITY INVOKER;
ALTER FUNCTION public.unmark_hired(uuid) SECURITY INVOKER;