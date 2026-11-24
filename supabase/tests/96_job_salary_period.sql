-- A job's salary range has a pay period: older jobs got one by the range's size,
-- a change of period re-scores like a change of range, and the dossiers that left
-- salary out are queued. Ends by raising its result: nothing is kept.
do $t$
declare
  r text := '';
  n int;
  def text;
begin
  select count(*) into n from public.jobs
   where salary_period is null and (salary_min is not null or salary_max is not null);
  r := 'every_range_has_a_period=' || (n = 0);
  select count(*) into n from public.jobs
   where upper(coalesce(currency, 'USD')) = 'MXN' and salary_period = 'monthly'
     and coalesce(salary_max, salary_min) between 5000 and 200000;
  r := r || ' mxn_monthly=' || n;
  select count(*) into n from public.jobs where salary_period = 'annual';
  r := r || ' annual=' || n;
  def := pg_get_functiondef('public.fit_queue_on_job_change'::regproc);
  r := r || ' period_rescores=' || (position('new.salary_period is not distinct from old.salary_period' in def) > 0);
  select count(*) into n from public.fit_analysis_queue q
    join public.job_candidate_associations a on a.id = q.association_id
    join public.candidates c on c.id = a.candidate_id
   where q.status = 'pending' and c.salary_amount > 0;
  r := r || ' queued_with_salary=' || n;
  r := r || ' triggers_on=' || (not exists (select 1 from pg_trigger where tgrelid = 'public.jobs'::regclass and not tgisinternal and tgenabled <> 'O'));
  raise exception 'RESULT %', r;
end $t$;
