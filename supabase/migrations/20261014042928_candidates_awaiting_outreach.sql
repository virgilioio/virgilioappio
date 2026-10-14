-- "Awaiting outreach" on the Candidates page (2026-10-14). The header counts
-- these with get_candidate_kpis(), but the list itself applied no filter and
-- showed everyone. This returns the same people the count counts: in an
-- active pipeline (not rejected, hired, withdrawn or archived) and never sent
-- an outbound email. Same access check as get_candidate_kpis().

create function public.get_candidates_awaiting_outreach(_tenant_id uuid)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.user_has_tenant_access(_tenant_id) then
    raise exception 'Access denied to tenant';
  end if;

  return query
  select distinct jca.candidate_id
  from public.job_candidate_associations jca
  join public.candidates c on c.id = jca.candidate_id
  where c.tenant_id = _tenant_id
    and c.deleted_at is null
    and (jca.status is null or jca.status not in ('rejected', 'hired', 'withdrawn', 'archived'))
    and not exists (
      select 1 from public.email_logs el
      where el.candidate_id = jca.candidate_id and el.direction = 'outbound'
    );
end;
$$;

revoke all on function public.get_candidates_awaiting_outreach(uuid) from public, anon;
grant execute on function public.get_candidates_awaiting_outreach(uuid) to authenticated, service_role;
