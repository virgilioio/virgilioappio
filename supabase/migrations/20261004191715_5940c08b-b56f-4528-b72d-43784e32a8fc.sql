alter table public.organizations add column if not exists is_internal boolean not null default false;
update public.organizations set is_internal = true
 where tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab' and org_kind = 'client' and lower(btrim(name)) = 'virgilio';

create or replace function public.sales_company_upsert(payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  _t uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  _key text := payload->>'idempotency_key';
  _co jsonb := payload->'company';
  _cid uuid := (_co->>'id')::uuid;
  _org uuid; _created bool := false; _status text; _res jsonb; _prior jsonb;
begin
  if _key is null or _cid is null then raise exception 'idempotency_key and company.id are required'; end if;
  select response into _prior from public.integration_inbox where idempotency_key = _key;
  if found then return _prior; end if;

  _status := case when coalesce((_co->>'deleted')::bool, false) then 'inactive'
                  when _co->>'status' = 'churned' then 'inactive' else 'active' end;

  select id into _org from public.organizations
   where tenant_id = _t and org_kind = 'client' and sales_company_id = _cid limit 1;
  if _org is null then
    insert into public.organizations(name, tenant_id, org_kind, organization_type, status, parent_organization_id, sales_company_id)
    values (coalesce(nullif(btrim(_co->>'name'), ''), 'Unnamed client'), _t, 'client', 'client', _status, _tenant_id_root(_t), _cid)
    returning id into _org;
    _created := true;
  end if;

  update public.organizations set
    name = coalesce(nullif(btrim(_co->>'name'), ''), name),
    website = case when nullif(btrim(_co->>'domain'), '') is not null then 'https://' || btrim(_co->>'domain') else website end,
    industry = coalesce(nullif(_co->>'industry', ''), industry),
    hq_city = coalesce(nullif(_co->>'city', ''), hq_city),
    country = coalesce(nullif(_co->>'country', ''), country),
    status = _status,
    updated_at = now()
  where id = _org;

  _res := jsonb_build_object('organization_id', _org, 'created', _created);
  insert into public.integration_inbox(idempotency_key, endpoint, response, status_code)
  values (_key, 'sales-company-upsert', _res, 200) on conflict (idempotency_key) do nothing;
  return _res;
end $$;
revoke execute on function public.sales_company_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.sales_company_upsert(jsonb) to service_role;