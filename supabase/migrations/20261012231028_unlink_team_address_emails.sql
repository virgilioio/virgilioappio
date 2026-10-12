-- Team mail filed under test candidates (2026-10-12).
-- Six candidate records use a team address (a Gio user's or a connected
-- inbox's email), e.g. "Alonso Rodriguez" saved with allan@virgilio.tech.
-- Gmail sync matched every email from or to that address to the record, so
-- teammates' business mail showed on the candidate's Emails tab. The sync no
-- longer matches team addresses; this detaches the Gmail-synced emails those
-- records collected. Emails Gio itself sent (no inbox) stay linked.

with team as (
  select lower(email_address) as em from public.user_mail_identities where email_address is not null
  union
  select lower(email) from public.profiles where email is not null
),
team_candidates as (
  select c.id
  from public.candidates c
  join team t on t.em = lower(btrim(c.email)) or t.em = lower(btrim(c.contact_email))
)
update public.email_logs e
set candidate_id = null
where e.mail_identity_id is not null
  and e.candidate_id in (select id from team_candidates);
