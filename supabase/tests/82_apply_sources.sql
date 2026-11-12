-- Run after 20261112155416_apply_sources inside a transaction that is rolled back.
-- Applications record where they came from, and each person gets one share code.
--   someone    an active member of a workspace
--   other      another active member
-- Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

create or replace function pg_temp.as_user(_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.as_admin()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
end $$;

create or replace function pg_temp.err_of(_sql text)
returns text
language plpgsql
as $$
begin
  execute _sql;
  return 'none';
exception when others then
  return sqlstate;
end $$;

do $$
declare
  someone uuid;
  other uuid;
  jca uuid;
  c1 text;
  c2 text;
  c3 text;
  seen int;
  e text;
begin
  select m.user_id into someone from public.members m where m.user_status = 'active' order by m.created_at limit 1;
  select m.user_id into other from public.members m where m.user_status = 'active' and m.user_id <> someone order by m.created_at limit 1;
  insert into t_results values ('found two members to try it as', someone is not null and other is not null);

  select id into jca from public.job_candidate_associations order by created_at desc limit 1;

  -- The channel key is a short lowercase word.
  e := pg_temp.err_of(format('update public.job_candidate_associations set applied_via = %L where id = %L', 'linkedin', jca));
  insert into t_results values ('a channel key is accepted (' || e || ')', e = 'none');
  e := pg_temp.err_of(format('update public.job_candidate_associations set applied_via = %L where id = %L', 'LinkedIn Post!', jca));
  insert into t_results values ('anything else is refused (' || e || ')', e = '23514');
  e := pg_temp.err_of(format('update public.job_candidate_associations set applied_via = null, applied_via_detail = %L::jsonb where id = %L', '{"utm_source":"x"}', jca));
  insert into t_results values ('no channel is fine (older applications) (' || e || ')', e = 'none');

  -- One code per person, the same every time.
  perform pg_temp.as_user(someone);
  c1 := public.posting_share_code();
  c2 := public.posting_share_code();
  insert into t_results values ('a person gets a code (' || coalesce(c1, 'null') || ')', c1 ~ '^[a-z0-9]{8}$');
  insert into t_results values ('and the same one next time', c1 = c2);
  select count(*) into seen from public.posting_share_codes;
  insert into t_results values ('they see only their own code (' || seen || ')', seen = 1);

  perform pg_temp.as_user(other);
  c3 := public.posting_share_code();
  insert into t_results values ('someone else gets a different code', c3 is not null and c3 <> c1);
  select count(*) into seen from public.posting_share_codes where code = c1;
  insert into t_results values ('and can''t read the first person''s (' || seen || ')', seen = 0);
  e := pg_temp.err_of(format('insert into public.posting_share_codes (user_id, code) values (%L, %L)', other, 'abcdefgh'));
  insert into t_results values ('nobody writes codes directly (' || e || ')', e = '42501');

  perform pg_temp.as_admin();
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'authenticated', true);
  e := pg_temp.err_of('select public.posting_share_code()');
  insert into t_results values ('no signed-in person is refused (' || e || ')', e = 'GSH01');

  perform pg_temp.as_admin();
  insert into t_results values ('anon can''t ask for a code',
    not has_function_privilege('anon', 'public.posting_share_code()', 'execute'));
  insert into t_results values ('anon can''t read codes',
    not has_table_privilege('anon', 'public.posting_share_codes', 'select'));
end $$;

select * from t_results;
