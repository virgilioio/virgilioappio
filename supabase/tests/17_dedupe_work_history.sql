-- Run after 20261017170000_dedupe_work_history inside a transaction that is rolled back.
-- Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

with p(candidate_id) as (values
 ('2c046f23-dcad-48e4-a553-69b7875f65b1'::uuid),('2cd54339-1c12-4aba-b406-9cd9f0b7fdb3'),('d006202e-43a3-4dd6-8db2-ad6bba939baf'),('2174e60f-6655-4f6b-bae5-c7739742a075'),
 ('90f28272-cb6f-4d0c-bea6-81fb170f790d'),('c1ce12b8-c356-4388-812b-6bbb635ad1cd'),('f49b93e4-1a34-416f-b84a-0e4a9829b3d5'),('68174a8f-f728-440e-8b0b-0741abaf622c'),
 ('bad6539c-5e9f-496b-9197-c94002ebded0'),('85307d5e-d5fa-49ba-9abe-ccd3f1739aac'),('2ecf6f15-a4bd-406c-b295-345c6dd7dc99'),('89e1fc4e-db1f-4e29-8c51-16caf7a1615b'),
 ('5e736a41-aaf9-439e-a2d1-d7de9ef56a1f'),('fb70e3fb-7e94-4b5f-9425-bd8ce6adf3d3'),('3501759a-523f-4681-843e-9e57265d947b'),('c57e1a57-eba6-49aa-8620-0f3061286d8b'),
 ('5ce9e95a-d1db-4ada-89dc-38a567b2751c'),('772cef34-bc23-4aca-8e23-fa00d92e8b7b'),('7f0cfb32-3fa2-4805-9a7b-1861efa07bc2'),('0dc87b79-6bfc-4658-b078-75954bf9af00'),
 ('8f7aa8fe-e735-4b53-b3b3-89835a571952')),
g as (
  select w.candidate_id, count(*) n
  from public.candidate_work_experience w join p using (candidate_id)
  group by w.candidate_id, lower(btrim(w.company_name)), lower(btrim(w.job_title)), w.start_date)
insert into t_results
select 'no doubled job left on the 21 profiles', coalesce(max(n), 1) = 1 from g
union all
select 'the 21 profiles keep 175 job rows (196 less 21)', (select count(*) from public.candidate_work_experience w join p using (candidate_id)) = 175
union all
select 'every one of the 21 profiles still has its history', (select count(distinct w.candidate_id) from public.candidate_work_experience w join p using (candidate_id)) = 21;

insert into t_results
select 'two descriptions kept on the Pencil job (MARIA DE MONTSERRAT F.)',
  (select count(*) = 1 and bool_and(description like '%' || E'\n\n' || '%')
     from public.candidate_work_experience
    where candidate_id = '3501759a-523f-4681-843e-9e57265d947b' and job_title = 'Gen AI Creative Producer');

insert into t_results
select 'the 6 Coresignal profiles are untouched',
  (select count(*) from public.candidate_work_experience where candidate_id in (
     '8be1469e-adae-4777-88c4-6d5f0da957d1', '15e29ef3-04f9-4d25-8a1f-0a6befd87d9b', 'a50250ef-233d-4896-a89c-26eddc817c16',
     'd4167df1-c23f-4c1e-95f7-64bd59333a92', 'a6f219b1-ebca-40a9-979f-a718466f800b', '1b7d71f6-68d3-488a-9a78-2b7d012bedbc')) = 64;
