-- Interview notes, step 2 (Allan, 2026-11-11): somewhere to keep the interview itself
-- and what Gio recommends from it.
--
-- interview_transcripts: one row per interview (scheduled booking), written only by the
-- Edge Functions (service role). Today the booking holds just the note-taker's recap
-- email (transcript_raw); this keeps the full conversation fetched from Fireflies' API
-- (who said what, when), the call's language and length, Fireflies' own summary, and
-- where the notes got to (status) so the screens can say it and offer Retry.
--
-- job_stage_scorecards.ai_recommendation: Gio's recommendation with its evidence,
-- measured against the job's requirements (rating on the scorecard's five-point scale
-- or null, confidence, reason, and each requirement met / partly / not met / not
-- discussed with the quote and the moment in the call). ai_suggested_rating stays the
-- rating the sheet applies; the decision is always the interviewer's.

create table if not exists public.interview_transcripts (
  booking_id uuid primary key references public.scheduled_bookings(id) on delete cascade,
  tenant_id uuid,
  -- Where the text came from: the full transcript from Fireflies' API, or (when that
  -- isn't available) the recap email Fireflies or Read.ai sent, or another email.
  source text not null check (source in ('fireflies_api', 'fireflies_recap', 'read_ai', 'email')),
  -- Fireflies' transcript id (from the recap's link), when there is one.
  external_id text,
  -- The language the interview was held in (BCP 47, e.g. 'es', 'en', 'pt-BR').
  language text check (language is null or language ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  -- [{ "id": "…", "name": "…" }]
  speakers jsonb not null default '[]'::jsonb check (jsonb_typeof(speakers) = 'array'),
  -- [{ "i": 0, "speaker": "…", "text": "…", "start": 12.4, "end": 15.1 }] (seconds)
  sentences jsonb not null default '[]'::jsonb check (jsonb_typeof(sentences) = 'array'),
  -- The note-taker's own summary as it gave it (overview, keywords, action items…).
  provider_summary jsonb check (provider_summary is null or jsonb_typeof(provider_summary) = 'object'),
  -- received: the email is in; fetching: getting the transcript from Fireflies;
  -- ready: text in hand; drafting: Gio is writing the notes; drafted: notes written;
  -- nothing_said: nothing to write notes from; failed: see status_reason.
  status text not null default 'received'
    check (status in ('received', 'fetching', 'ready', 'drafting', 'drafted', 'nothing_said', 'failed')),
  -- A short, readable reason for the person ("Fireflies didn't have this meeting"),
  -- never a raw server message.
  status_reason text check (status_reason is null or length(status_reason) <= 300),
  status_at timestamptz not null default now(),
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.interview_transcripts is
  'One interview''s transcript (Fireflies API, or the note-taker''s recap email), its language, length, speakers and where Gio''s notes got to. Written only by process-transcript-webhook / generate-scorecard-from-transcript (service role); read by whoever can read the booking.';

create index if not exists interview_transcripts_external_id_idx
  on public.interview_transcripts (external_id) where external_id is not null;
create index if not exists interview_transcripts_tenant_idx
  on public.interview_transcripts (tenant_id);

create or replace trigger interview_transcripts_updated_at
  before update on public.interview_transcripts
  for each row execute function public.update_updated_at_column();

alter table public.interview_transcripts enable row level security;

-- Read: exactly the people who can read the interview itself (scheduled_bookings' own
-- rules apply inside the subquery). No write rules: only the Edge Functions write.
create policy interview_transcripts_read on public.interview_transcripts
  for select to authenticated
  using (exists (select 1 from public.scheduled_bookings b where b.id = interview_transcripts.booking_id));

revoke all on public.interview_transcripts from anon;
revoke insert, update on public.interview_transcripts from authenticated;
grant select on public.interview_transcripts to authenticated;

-- Live status for the scorecard and the profile (Notes drafted · Retry).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'interview_transcripts'
     ) then
    alter publication supabase_realtime add table public.interview_transcripts;
  end if;
end $$;

alter table public.job_stage_scorecards
  add column if not exists ai_recommendation jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'job_stage_scorecards_ai_recommendation_object'
  ) then
    alter table public.job_stage_scorecards
      add constraint job_stage_scorecards_ai_recommendation_object
      check (ai_recommendation is null or jsonb_typeof(ai_recommendation) = 'object');
  end if;
end $$;

comment on column public.job_stage_scorecards.ai_recommendation is
  'Gio''s recommendation from the interview, measured against the job: { rating (five-point scale or null), confidence (high · medium · low), reason, language, source_kind, criteria: [{ kind (must · nice · years · location · salary · question), label, verdict (met · partly · not_met · not_discussed), evidence, quote, at (seconds) }], generated_at }. A suggestion only: the interviewer chooses the rating.';
