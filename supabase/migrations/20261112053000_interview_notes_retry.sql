-- Interview notes, step 5 (Allan, Go! 2026-11-12): Retry from the screens.
--
-- The status line on an interview ("Couldn't write the notes · Retry") asks Gio to
-- write the notes again. Only the server may start generate-scorecard-from-transcript
-- (service role key or the internal secret), so the browser asks this function, which
-- checks who is asking and starts the run the way a run from the database does
-- (x-internal-secret from Vault, find: true so a meeting with no recap is looked up
-- in Fireflies by time and attendee). The run itself answers 202 and drafts in the
-- background; interview_transcripts.status says where it got to (live on Realtime).
--
-- Who: the interview's interviewer, and whoever manages the job (admins and the job's
-- Recruiter, can_manage_job). Refused (GIN01) for anyone else.
-- Not when the interviewer's scorecard for it is already submitted (GIN02): a run only
-- rewrites a draft. Not while Gio is still at work, or within 2 minutes of the last
-- start (GIN03); a run stuck for 10 minutes counts as over.

create or replace function public.interview_notes_retry(p_booking uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  b record;
  t record;
  v_submitted boolean;
begin
  select id, job_id, interviewer_id, job_candidate_association_id, job_hiring_stage_id, tenant_id
    into b
  from public.scheduled_bookings
  where id = p_booking;

  if b.id is null
     or auth.uid() is null
     or not (b.interviewer_id = auth.uid() or (b.job_id is not null and public.can_manage_job(b.job_id))) then
    raise exception 'You can''t ask Gio to redo the notes for this interview.' using errcode = 'GIN01';
  end if;

  select exists (
    select 1 from public.job_stage_scorecards s
    where s.association_id = b.job_candidate_association_id
      and s.stage_instance_id = b.job_hiring_stage_id
      and s.created_by = b.interviewer_id
      and coalesce(s.is_ai_draft, false) = false
  ) into v_submitted;
  if v_submitted then
    raise exception 'The scorecard for this interview is already submitted.' using errcode = 'GIN02';
  end if;

  select status, status_at into t
  from public.interview_transcripts
  where booking_id = b.id
  for update;

  if t.status is not null and (
       (t.status in ('received', 'fetching', 'ready', 'drafting') and t.status_at > now() - interval '10 minutes')
       or t.status_at > now() - interval '2 minutes') then
    raise exception 'Gio is already working on these notes.' using errcode = 'GIN03';
  end if;

  if t.status is not null then
    update public.interview_transcripts
       set status = 'received', status_reason = null, status_at = now()
     where booking_id = b.id;
  end if;

  perform net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/generate-scorecard-from-transcript',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')),
    body := jsonb_build_object('booking_id', b.id, 'find', true),
    timeout_milliseconds := 30000);

  return jsonb_build_object('status', 'received', 'booking_id', b.id);
end;
$function$;

revoke all on function public.interview_notes_retry(uuid) from public, anon;
grant execute on function public.interview_notes_retry(uuid) to authenticated;

comment on function public.interview_notes_retry(uuid) is
  'Asks Gio to write an interview''s notes again (the status line''s Retry). The interviewer or whoever manages the job, not once the scorecard is submitted (GIN02) or while a run is under way or within 2 minutes of the last (GIN03), GIN01 for anyone else.';
