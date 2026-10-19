-- Run after 20261019031231_offer_form_sections inside a transaction that is rolled back.
-- Fake offer forms and fields; the real forms are only read. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
create temp table t_ids (k text primary key, v uuid);
insert into t_ids values ('f1', gen_random_uuid()), ('f2', gen_random_uuid());

-- The real forms: four default sections each, and every field placed.
insert into t_results select 'existing forms: the four default sections, in order',
  not exists (
    select 1 from public.offer_forms f
    where f.id not in (select v from t_ids)
      and (select array_agg(s->>'id' order by n) from jsonb_array_elements(f.sections) with ordinality x(s, n))
          is distinct from array['role', 'compensation', 'benefits', 'additional']);
insert into t_results select 'existing fields: every one sits in a section',
  not exists (select 1 from public.offer_form_fields where section_key is null);
insert into t_results select 'existing fields: where the composer showed them',
  not exists (select 1 from public.offer_form_fields where field_label = 'Base Salary' and section_key <> 'compensation')
  and not exists (select 1 from public.offer_form_fields where field_label = 'Start Date' and section_key <> 'role')
  and not exists (select 1 from public.offer_form_fields where field_label = 'Phone Number' and section_key <> 'additional')
  and exists (select 1 from public.offer_form_fields where field_label = 'On-Target Earnings (OTE)' and section_key = 'compensation');

-- A new form starts with the defaults.
insert into public.offer_forms (id, name, is_active) select v, 'Fake form one', true from t_ids where k = 'f1';
insert into t_results select 'new form: starts with the four default sections',
  (select jsonb_array_length(sections) = 4 and sections->0->>'title' = 'Role & start' and (sections->1->>'columns')::int = 1
   from public.offer_forms where id = (select v from t_ids where k = 'f1'));

-- Fields: one with a section, one without, one with a section the form doesn't have.
insert into public.offer_form_fields (form_id, field_name, field_label, field_type, display_order, section_key)
select (select v from t_ids where k = 'f1'), n, l, 'text', o, s
from (values ('perk', 'Perk', 0, 'benefits'), ('note', 'Note', 1, null), ('odd', 'Odd', 2, 'nowhere')) x(n, l, o, s);
insert into t_results select 'fields: keep the section they were given',
  (select section_key = 'benefits' from public.offer_form_fields where form_id = (select v from t_ids where k = 'f1') and field_name = 'perk');
insert into t_results select 'fields: without a section, or with an unknown one, go in the last section',
  (select bool_and(section_key = 'additional') from public.offer_form_fields
   where form_id = (select v from t_ids where k = 'f1') and field_name in ('note', 'odd'));

-- Rename, reorder, a new section, one column: fields stay put.
update public.offer_forms
   set sections = '[{"id":"benefits","title":"Perks","columns":2},{"id":"role","title":"The role","columns":1},
                    {"id":"compensation","title":"Pay","columns":1},{"id":"additional","title":"Other","columns":2},
                    {"id":"x1","title":"Legal","columns":1}]'
 where id = (select v from t_ids where k = 'f1');
insert into t_results select 'rename and reorder: fields stay in their sections',
  (select section_key = 'benefits' from public.offer_form_fields where form_id = (select v from t_ids where k = 'f1') and field_name = 'perk')
  and (select count(*) = 2 from public.offer_form_fields where form_id = (select v from t_ids where k = 'f1') and section_key = 'additional');
update public.offer_form_fields set section_key = 'x1' where form_id = (select v from t_ids where k = 'f1') and field_name = 'odd';
insert into t_results select 'move: a field moves to a new section',
  (select section_key = 'x1' from public.offer_form_fields where form_id = (select v from t_ids where k = 'f1') and field_name = 'odd');

-- Taking sections out: their fields go to the last section left.
update public.offer_forms
   set sections = '[{"id":"role","title":"The role","columns":1},{"id":"x1","title":"Legal","columns":1}]'
 where id = (select v from t_ids where k = 'f1');
insert into t_results select 'take out: the fields of a removed section go to the last one left',
  (select bool_and(section_key = 'x1') from public.offer_form_fields where form_id = (select v from t_ids where k = 'f1'));
update public.offer_forms set sections = '[]' where id = (select v from t_ids where k = 'f1');
insert into t_results select 'take out all: fields stay, in no section',
  (select count(*) = 3 and bool_and(section_key is null) from public.offer_form_fields where form_id = (select v from t_ids where k = 'f1'));
insert into public.offer_form_fields (form_id, field_name, field_label, field_type, display_order, section_key)
select v, 'late', 'Late', 'text', 3, 'role' from t_ids where k = 'f1';
insert into t_results select 'no sections: a new field sits in none',
  (select section_key is null from public.offer_form_fields where form_id = (select v from t_ids where k = 'f1') and field_name = 'late');
update public.offer_forms set sections = '[{"id":"a","title":"Everything","columns":2}]' where id = (select v from t_ids where k = 'f1');
insert into t_results select 'first section again: fields join it',
  (select count(*) = 4 and bool_and(section_key = 'a') from public.offer_form_fields where form_id = (select v from t_ids where k = 'f1'));

-- Bad section lists are refused.
create temp table t_bad (label text, s jsonb);
insert into t_bad values
  ('not a list', '{"id":"a"}'),
  ('two with one id', '[{"id":"a","title":"A","columns":1},{"id":"a","title":"B","columns":1}]'),
  ('no title', '[{"id":"a","title":"  ","columns":1}]'),
  ('three columns', '[{"id":"a","title":"A","columns":3}]'),
  ('no id', '[{"title":"A","columns":1}]'),
  ('columns as text', '[{"id":"a","title":"A","columns":"1"}]');
create temp table t_refused (label text);
do $$
declare r record;
begin
  for r in select * from t_bad loop
    begin
      insert into public.offer_forms (id, name, sections) values ((select v from t_ids where k = 'f2'), 'Fake form two', r.s);
      raise exception 'not refused';
    exception
      when sqlstate '22023' then insert into t_refused values (r.label);
      when others then null;
    end;
  end loop;
end $$;
insert into t_results select 'bad sections: every one refused (' || (select count(*) from t_refused) || ' of 6)',
  (select count(*) = 6 from t_refused);
insert into t_results select 'bad sections: nothing was saved',
  not exists (select 1 from public.offer_forms where id = (select v from t_ids where k = 'f2'));

select check_name as check, ok from t_results;
