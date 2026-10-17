-- Doubled jobs, one-off cleanup (Allan, 2026-10-17).
--
-- 21 profiles have the same job saved twice: Apollo listed it twice, or Gio
-- read it twice from a resume (both writers now save each job once). For each
-- of these profiles only, a job with the same company, title and start date
-- keeps its oldest row; the other copy is removed. Where the copies carry
-- different descriptions, the kept row gets both texts first.
--
-- Not touched: the 6 Coresignal profiles whose "duplicates" have an unknown
-- or blank company (probably different jobs), and every other profile.
-- Contains a row removal, so it is applied from a desktop chat.

create temp table t_dedupe_profiles (candidate_id uuid primary key) on commit drop;
insert into t_dedupe_profiles values
  ('2c046f23-dcad-48e4-a553-69b7875f65b1'), ('2cd54339-1c12-4aba-b406-9cd9f0b7fdb3'), -- Alfonso Cabello Arizpe
  ('d006202e-43a3-4dd6-8db2-ad6bba939baf'), ('2174e60f-6655-4f6b-bae5-c7739742a075'), -- Bruno De La Rosa
  ('90f28272-cb6f-4d0c-bea6-81fb170f790d'), ('c1ce12b8-c356-4388-812b-6bbb635ad1cd'), -- Claudia Boone
  ('f49b93e4-1a34-416f-b84a-0e4a9829b3d5'), ('68174a8f-f728-440e-8b0b-0741abaf622c'), -- Danel Aguirre Fernandez
  ('bad6539c-5e9f-496b-9197-c94002ebded0'), ('85307d5e-d5fa-49ba-9abe-ccd3f1739aac'), -- Daniela Romero Garcia
  ('2ecf6f15-a4bd-406c-b295-345c6dd7dc99'), ('89e1fc4e-db1f-4e29-8c51-16caf7a1615b'), -- Edu Maldonado
  ('5e736a41-aaf9-439e-a2d1-d7de9ef56a1f'),                                           -- Josh Brucal
  ('fb70e3fb-7e94-4b5f-9425-bd8ce6adf3d3'),                                           -- Maria De Montserrat
  ('3501759a-523f-4681-843e-9e57265d947b'),                                           -- MARIA DE MONTSERRAT F.
  ('c57e1a57-eba6-49aa-8620-0f3061286d8b'), ('5ce9e95a-d1db-4ada-89dc-38a567b2751c'), -- Paola Alday
  ('772cef34-bc23-4aca-8e23-fa00d92e8b7b'), ('7f0cfb32-3fa2-4805-9a7b-1861efa07bc2'), -- Santiago De Oriol
  ('0dc87b79-6bfc-4658-b078-75954bf9af00'),                                           -- Wylder Machado
  ('8f7aa8fe-e735-4b53-b3b3-89835a571952');                                           -- Yesica Vazquez

-- Every row of a doubled job on these profiles, oldest first.
create temp table t_dedupe_rows on commit drop as
select w.id, w.candidate_id, w.description,
       lower(btrim(w.company_name)) || '|' || lower(btrim(w.job_title)) || '|' || coalesce(w.start_date::text, '') as job_key,
       row_number() over (
         partition by w.candidate_id, lower(btrim(w.company_name)), lower(btrim(w.job_title)), w.start_date
         order by w.created_at, w.id
       ) as n,
       count(*) over (
         partition by w.candidate_id, lower(btrim(w.company_name)), lower(btrim(w.job_title)), w.start_date
       ) as copies
from public.candidate_work_experience w
join t_dedupe_profiles p on p.candidate_id = w.candidate_id
where coalesce(lower(btrim(w.company_name)), '') not in ('', 'unknown', 'unknown company');

-- The kept row carries every distinct description.
update public.candidate_work_experience w
   set description = d.merged
  from (
    select r.candidate_id, r.job_key, string_agg(distinct btrim(r.description), E'\n\n') as merged,
           count(distinct btrim(r.description)) as texts
    from t_dedupe_rows r
    where r.copies > 1 and nullif(btrim(r.description), '') is not null
    group by r.candidate_id, r.job_key
  ) d, t_dedupe_rows k
 where k.id = w.id and k.n = 1 and k.copies > 1
   and d.candidate_id = k.candidate_id and d.job_key = k.job_key
   and d.texts > 1;

-- Remove the extra copies.
delete from public.candidate_work_experience w
 using t_dedupe_rows r
 where r.id = w.id and r.copies > 1 and r.n > 1;
