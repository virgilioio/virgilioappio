-- Removing a user checks first, then removes (2026-10-13).
-- The remove-user edge function used to clear a person's profile, memberships
-- and assignments and only then their login. When some other row still pointed
-- at their login with no cascade or set-null rule (e.g.
-- organizations.billing_poc_updated_by), the login step failed and the person
-- was left half-removed. This function lists every such reference that still
-- has rows, read from the catalog so new tables are covered too; the edge
-- function refuses, with the reason, while the list isn't empty.
--
-- Rows the safe-removal RPC clears itself (profiles, members, activities and
-- job_assignments by user_id) don't count. Only the service role calls it.

create function public.user_deletion_blockers(p_user_id uuid)
returns table (table_name text, column_name text, row_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
  v_count bigint;
begin
  for r in
    select
      n.nspname as sch,
      c.relname as tbl,
      a.attname as col,
      rc.relname as ref_tbl,
      rn.nspname as ref_sch,
      ra.attname as ref_col
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    join pg_class rc on rc.oid = k.confrelid
    join pg_namespace rn on rn.oid = rc.relnamespace
    join pg_attribute ra on ra.attrelid = k.confrelid and ra.attnum = k.confkey[1]
    where k.contype = 'f'
      and k.confdeltype in ('a', 'r')
      and array_length(k.conkey, 1) = 1
      and n.nspname in ('public', 'audit')
      and c.relkind = 'r'
      and (
        (rn.nspname = 'auth' and rc.relname = 'users')
        or (rn.nspname = 'public' and rc.relname = 'profiles')
      )
      and not (
        n.nspname = 'public'
        and c.relname in ('profiles', 'members', 'activities', 'job_assignments')
        and a.attname = 'user_id'
      )
  loop
    if r.ref_sch = 'auth' then
      execute format('select count(*) from %I.%I where %I = $1', r.sch, r.tbl, r.col)
        into v_count using p_user_id;
    else
      execute format(
        'select count(*) from %I.%I where %I in (select %I from public.profiles where user_id = $1)',
        r.sch, r.tbl, r.col, r.ref_col)
        into v_count using p_user_id;
    end if;
    if v_count > 0 then
      table_name := r.tbl;
      column_name := r.col;
      row_count := v_count;
      return next;
    end if;
  end loop;
end;
$$;

revoke all on function public.user_deletion_blockers(uuid) from public, anon, authenticated;
grant execute on function public.user_deletion_blockers(uuid) to service_role;
