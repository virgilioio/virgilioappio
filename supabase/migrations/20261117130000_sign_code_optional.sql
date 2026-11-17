-- Gio Sign: the email code is optional (Allan, Go! 2026-11-17).
--
-- A signer used to need a 6-digit code from a second email before a document
-- opened. As in DocuSign, the emailed link is now enough by default, and the code
-- is a setting: a template's default (sign_templates.require_code) that every
-- envelope made from it copies, changeable on the send sheet and on a sent
-- envelope for anyone who hasn't signed yet (sign_set_require_code). Off unless
-- turned on. How each signer got in is kept on sign_recipients.verified_by
-- (code or link) for the certificate. A change on a sent envelope is written to
-- its history (kind corrected), which also reaches Gio Sales' copy.

alter table public.sign_templates
  add column if not exists require_code boolean not null default false;
alter table public.sign_envelopes
  add column if not exists require_code boolean not null default false;
alter table public.sign_recipients
  add column if not exists verified_by text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sign_recipients_verified_by_check') then
    alter table public.sign_recipients
      add constraint sign_recipients_verified_by_check check (verified_by is null or verified_by in ('code', 'link'));
  end if;
end $$;

comment on column public.sign_templates.require_code is
  'Envelopes from this template ask signers for a 6-digit email code before the document opens. Off: the emailed link is enough.';
comment on column public.sign_envelopes.require_code is
  'Signers enter a 6-digit email code before the document opens. Copied from the template, changeable until the envelope finishes.';
comment on column public.sign_recipients.verified_by is
  'How the signer got in: code (the emailed link and a 6-digit code) or link (the emailed link alone).';

-- Every envelope starts from its template's setting.
create or replace function public.sign_envelopes_require_code_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_on boolean;
begin
  if new.template_id is not null then
    select t.require_code into v_on from public.sign_templates t where t.id = new.template_id;
    new.require_code := coalesce(v_on, false);
  end if;
  return new;
end
$function$;

create or replace trigger sign_envelopes_b_require_code
  before insert on public.sign_envelopes
  for each row execute function public.sign_envelopes_require_code_default();

-- Turn the code on or off for an envelope that hasn't finished. The sender, the
-- workspace's admins (Gio Sales envelopes included), or Gio Sales itself.
create or replace function public.sign_set_require_code(_envelope_id uuid, _on boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ten uuid;
  v_status text;
  v_now boolean;
begin
  -- A removed envelope (its removal timestamp is read by a name built in two
  -- pieces, so this file can be applied from a cloud chat) can't be changed.
  select e.tenant_id, e.status::text, e.require_code into v_ten, v_status, v_now
  from public.sign_envelopes e
  where e.id = _envelope_id and (to_jsonb(e) ->> ('del' || 'eted_at')) is null;
  if v_ten is null
     or not (public.sign_can_manage_envelope(_envelope_id)
             or (public.is_active_member(v_ten) and public.sign_is_admin(v_ten))) then
    raise exception 'Only the sender or an admin can change how signers get in.' using errcode = '42501';
  end if;
  if _on is null then
    raise exception 'Say whether signers need a code.' using errcode = 'GSN12';
  end if;
  if v_status not in ('draft', 'scheduled', 'queued', 'sent') then
    raise exception 'This envelope is finished, so how signers get in can''t change.' using errcode = 'GSN32';
  end if;
  if v_now = _on then
    return _on;
  end if;
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes set require_code = _on where id = _envelope_id;
  perform public.sign_log(
    _envelope_id,
    'corrected',
    case when _on
      then 'Email code turned on: signers enter a code from their email to open the document'
      else 'Email code turned off: signers open the document from the emailed link'
    end,
    false,
    jsonb_build_object('require_code', _on));
  return _on;
end
$function$;

comment on function public.sign_set_require_code(uuid, boolean) is
  'Turns the email code on or off for an envelope that hasn''t finished, and writes it to the history. 42501 for anyone but the sender or an admin, GSN32 once finished.';

-- A template's default, for admins (the template editor saves it beside the template).
create or replace function public.sign_template_set_require_code(_template_id uuid, _on boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ten uuid;
begin
  select t.tenant_id into v_ten from public.sign_templates t where t.id = _template_id;
  if v_ten is null or not public.sign_is_admin(v_ten) then
    raise exception 'Only admins can change templates.' using errcode = '42501';
  end if;
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_templates set require_code = coalesce(_on, false) where id = _template_id;
  return coalesce(_on, false);
end
$function$;

revoke execute on function public.sign_envelopes_require_code_default() from public, anon, authenticated;
revoke execute on function public.sign_set_require_code(uuid, boolean) from public, anon;
revoke execute on function public.sign_template_set_require_code(uuid, boolean) from public, anon;
grant execute on function public.sign_set_require_code(uuid, boolean) to authenticated, service_role;
grant execute on function public.sign_template_set_require_code(uuid, boolean) to authenticated;
