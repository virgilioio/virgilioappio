-- Gmail cleanup, step 1 of 2 (2026-10-12, approved by Allan).
-- Before the sync fix this morning, Gmail sync stored every email in the
-- connected inboxes. Some of the unlinked ones are real candidate mail that
-- arrived before the candidate existed. Link those to their candidate so they
-- show on the candidate's timeline and survive step 2.
--
-- An email is linked when its sender or a recipient is the email of exactly
-- one candidate in the tenant. Team addresses (@virgilio.tech, connected
-- inboxes, Gio users) never count as a candidate's address.

with team as (
  select lower(email_address) as em from public.user_mail_identities where email_address is not null
  union
  select lower(email) from auth.users where email is not null
),
cand as (
  select c.tenant_id, lower(btrim(x)) as em, min(c.id::text)::uuid as candidate_id, count(*) as n
  from public.candidates c, unnest(array[c.email, c.contact_email]) x
  where x is not null and x like '%@%' and c.deleted_at is null
    and lower(btrim(x)) not like '%@virgilio.tech'
    and lower(btrim(x)) not in (select em from team)
  group by 1, 2
),
addrs as (
  select e.id, e.tenant_id, lower(e.from_address) as em
  from public.email_logs e
  where e.candidate_id is null and e.mail_identity_id is not null
  union all
  select e.id, e.tenant_id, lower(a)
  from public.email_logs e, unnest(e.to_addresses) a
  where e.candidate_id is null and e.mail_identity_id is not null
),
matches as (
  select a.id, min(c.candidate_id::text)::uuid as candidate_id
  from addrs a
  join cand c on c.tenant_id = a.tenant_id and c.em = a.em
  group by a.id
  having count(distinct c.candidate_id) = 1 and max(c.n) = 1
)
update public.email_logs e
set candidate_id = m.candidate_id
from matches m
where e.id = m.id and e.candidate_id is null;
