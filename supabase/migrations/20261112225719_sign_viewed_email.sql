-- The sender hears by email when someone opens their agreement (Allan,
-- 2026-11-12, as in DocuSign). "Someone opens it" (viewed) now emails by
-- default, once per recipient on their first open after their code
-- (notifySenderViewed); a sender can still switch it off in their Sign
-- notification settings. The other defaults are unchanged.

create or replace function public.sign_pref(_tenant_id uuid, _email text, _event text)
 returns table(by_email boolean, in_app boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(p.by_email, d.by_email), coalesce(p.in_app, d.in_app)
  from (values
    ('signed', true, true), ('completed', true, true), ('declined', true, true),
    ('viewed', true, true), ('expiring', true, false)
  ) as d(event, by_email, in_app)
  left join public.sign_notification_prefs p
    on p.tenant_id = _tenant_id and p.email = lower(_email) and p.event = d.event
  where d.event = _event;
$function$;
