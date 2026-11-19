-- Gio Sign: an admin can send a reminder for an agreement sent from Gio Sales (2026-11-18).
--
-- "Send reminder" in the ATS was refused for every Gio Sales agreement, admins
-- included, with "Only an envelope that's out for signature can be reminded",
-- which was untrue: the envelope was out and it was the admin's own turn to
-- sign. The rule is now the email code switch's (sign_set_require_code): the
-- sender, or an admin of the workspace, whichever app it was sent from. Gio
-- Sales' own reminder (sign_sales_manage) is unchanged. A refusal now says
-- which of the two it is: not yours to remind (42501), or not out for
-- signature (GSN07).

create or replace function public.sign_remind_request(_envelope_id uuid)
returns table (recipient_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  e public.sign_envelopes;
begin
  select * into e from public.sign_envelopes where id = _envelope_id for update;
  if e.id is null
     or not (public.sign_can_manage_envelope(_envelope_id)
             or (e.origin = 'sales' and public.is_active_member(e.tenant_id) and public.sign_is_admin(e.tenant_id))) then
    raise exception 'Only the sender or an admin can send a reminder.' using errcode = '42501';
  end if;
  if e.status <> 'sent' then
    raise exception 'Only an envelope that''s out for signature can be reminded.' using errcode = 'GSN07';
  end if;
  if e.last_reminded_at is not null and e.last_reminded_at > now() - interval '1 hour' then
    raise exception 'A reminder went out in the last hour. Try again later.' using errcode = 'GSN26';
  end if;
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes set last_reminded_at = now() where id = e.id;
  return query
    select r.id from public.sign_recipients r
    join public.sign_recipient_secrets s on s.recipient_id = r.id
    where r.envelope_id = e.id and r.removed_at is null and r.role <> 'cc'
      and r.status in ('sent', 'viewed') and s.token_issued_at is not null;
end;
$function$;

comment on function public.sign_remind_request(uuid) is
  'Who gets a reminder for an envelope that is out for signature: signers whose turn it is and who have a link. For the sender or a workspace admin (Gio Sales agreements included), once an hour. 42501 not yours, GSN07 not out for signature, GSN26 reminded in the last hour.';
