-- Run after 20261020120000_candidate_video_files inside a transaction that is
-- rolled back. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
insert into t_results values ('candidate files take up to 500 MB',
  (select file_size_limit from storage.buckets where id = 'candidate-attachments') = 524288000);
insert into t_results values ('candidate files stay private',
  (select not public from storage.buckets where id = 'candidate-attachments'));
insert into t_results values ('no file type list was added (any file still uploads)',
  (select allowed_mime_types is null from storage.buckets where id = 'candidate-attachments'));
insert into t_results values ('no other bucket changed',
  (select file_size_limit from storage.buckets where id = 'sign-files') = 26214400);
select * from t_results;
