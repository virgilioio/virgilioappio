-- Find Phase 3 (2026-10-12): a record a person creates through a server
-- function (the Add candidate form goes through merge-candidates) carries
-- created_by. Its values are that person's, not "system", so Apollo never
-- replaces them. Sources with their own provenance (apollo, applications,
-- the extension, imports) keep it.

create or replace function public.candidates_track_provenance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_src text := nullif(current_setting('gio.write_source', true), '');
  v_actor text := nullif(current_setting('gio.write_actor', true), '');
  v_uid uuid := auth.uid();
  v_at text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_prov jsonb;
  v_entry jsonb;
  f text;
begin
  if v_actor is null and v_uid is not null then
    v_actor := v_uid::text;
  end if;

  if tg_op = 'INSERT' then
    v_src := coalesce(v_src, public.provenance_source_for(new.source),
                      case when v_uid is not null or new.created_by is not null then 'person' else 'system' end);
    if v_actor is null and new.created_by is not null then
      v_actor := new.created_by::text;
    end if;
    v_prov := '{}'::jsonb;
    foreach f in array public.candidate_tracked_fields() loop
      continue when f in ('salary_currency', 'salary_period') and new.salary_amount is null;
      if nullif(btrim(v_new ->> f), '') is not null then
        v_entry := jsonb_build_object('src', v_src, 'at', v_at);
        if v_actor is not null then v_entry := v_entry || jsonb_build_object('by', v_actor); end if;
        v_prov := v_prov || jsonb_build_object(f, v_entry);
      end if;
    end loop;
    new.field_provenance := v_prov;
    return new;
  end if;

  v_old := to_jsonb(old);
  if v_src is null then
    new.field_provenance := old.field_provenance;
    v_src := case when v_uid is not null then 'person' else 'system' end;
  end if;
  v_prov := coalesce(new.field_provenance, '{}'::jsonb);

  foreach f in array public.candidate_tracked_fields() loop
    continue when f in ('salary_currency', 'salary_period') and new.salary_amount is null;
    if (v_new -> f) is distinct from (v_old -> f) then
      if nullif(btrim(v_new ->> f), '') is null then
        v_prov := v_prov - f;
      else
        v_entry := jsonb_build_object('src', v_src, 'at', v_at);
        if v_actor is not null then v_entry := v_entry || jsonb_build_object('by', v_actor); end if;
        v_prov := v_prov || jsonb_build_object(f, v_entry);
      end if;
    end if;
  end loop;

  new.field_provenance := v_prov;
  return new;
end
$$;
