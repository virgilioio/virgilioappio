-- Bring an offboarded person back (People & Access, Allan 2026-10-14).
--
-- os_reactivate_ats() is the database half, run as the admin who clicked:
-- the same rules as offboarding (admins only, never yourself, only a platform
-- admin for a platform admin), then their ATS membership is active again,
-- People & Access shows them active, and any unfinished offboarding is closed.
-- The os-offboard edge function then lifts their sign-in block, and the page
-- applies the job role the admin picked, which restores Gio Sales and Gio Docs
-- access through the usual sending. Job team seats and the Google connection
-- are not restored: an admin seats them again, and they reconnect Google.

alter table public.os_offboardings
  add column reactivated_at timestamptz,
  add column reactivated_by uuid references auth.users(id);

create or replace function public.os_reactivate_ats(_tenant_id uuid, _user_id uuid)
returns jsonb language plpgsql security definer set search_path = 'public' as $$
declare target public.members%rowtype;
begin
  if not public.is_os_admin(_tenant_id) then
    raise exception 'Only admins can bring people back.' using errcode = '42501';
  end if;
  if _user_id = auth.uid() then
    raise exception 'You can''t change your own access. Ask another admin.' using errcode = 'GOS03';
  end if;
  select * into target from public.members
  where tenant_id = _tenant_id and user_id = _user_id
  order by (user_status = 'active') desc limit 1;
  if not found then
    raise exception 'This person is not a member of the workspace.' using errcode = 'GOS02';
  end if;
  if target.user_type = 'platform_admin' and public.get_user_type_secure() <> 'platform_admin' then
    raise exception 'Only a platform admin can bring back a platform admin.' using errcode = 'GOS03';
  end if;

  update public.members set user_status = 'active'
  where tenant_id = _tenant_id and user_id = _user_id and user_status = 'inactive';

  insert into public.os_person_profile (tenant_id, user_id, status)
  values (_tenant_id, _user_id, 'active')
  on conflict (tenant_id, user_id) do update set status = 'active';

  update public.os_offboardings
  set reactivated_at = now(), reactivated_by = auth.uid(),
      finished_at = coalesce(finished_at, now())
  where tenant_id = _tenant_id and user_id = _user_id and reactivated_at is null;

  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.os_reactivate_ats(uuid, uuid) from public, anon;
grant execute on function public.os_reactivate_ats(uuid, uuid) to authenticated;
