-- Gmail cleanup, round 2 (2026-10-12). Allan approved removing stored mail
-- that isn't candidate mail. Six test candidates saved with team addresses
-- (e.g. "Alonso Rodriguez" with allan@virgilio.tech) had pulled 310 team
-- emails into Gio; 20261012231028 detached them, and the sync no longer
-- matches team addresses. This removes what's left that isn't candidate mail,
-- with the same rules as 20261012201408 (no date limit this time):
--   * synced from a connected Gmail inbox, not linked to a candidate or job,
--   * not in a thread that holds a candidate email in the same inbox,
--   * not sent to or from any candidate's address.
-- Applied from a desktop chat: the cloud connector can't run a removal.

set local statement_timeout = '10min';

with team as (
  select lower(email_address) as em from public.user_mail_identities where email_address is not null
  union
  select lower(email) from auth.users where email is not null
),
cand_emails as (
  select distinct c.tenant_id, lower(btrim(x)) as em
  from public.candidates c, unnest(array[c.email, c.contact_email]) x
  where x is not null and x like '%@%' and c.deleted_at is null
    and lower(btrim(x)) not like '%@virgilio.tech'
    and lower(btrim(x)) not in (select em from team)
),
candidate_threads as (
  select distinct mail_identity_id, thread_id
  from public.email_logs
  where candidate_id is not null and thread_id is not null and mail_identity_id is not null
),
target as (
  select e.id, e.tenant_id, lower(e.from_address) as from_em, e.to_addresses
  from public.email_logs e
  left join candidate_threads ct
    on ct.mail_identity_id = e.mail_identity_id and ct.thread_id = e.thread_id
  where e.mail_identity_id is not null
    and e.candidate_id is null
    and e.job_id is null
    and ct.thread_id is null
),
addrs as (
  select t.id, t.tenant_id, t.from_em as em from target t
  union all
  select t.id, t.tenant_id, lower(a) from target t, unnest(t.to_addresses) a
),
keep as (
  select distinct a.id
  from addrs a
  join cand_emails ce on ce.tenant_id = a.tenant_id and ce.em = a.em
)
delete from public.email_logs e
using target t
where e.id = t.id
  and not exists (select 1 from keep k where k.id = t.id);
