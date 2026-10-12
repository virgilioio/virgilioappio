-- Email attachment files whose email is gone (2026-10-12).
-- Gmail sync saves attachments under email-attachments/<inbox>/<message>/<file>.
-- When the email row is removed (the Gmail cleanup, or a person asking to be
-- forgotten) the files stay behind. This lists them so the
-- email-attachments-sweep edge function can clear them with the Storage API.
-- A file counts only when no email references it, no email with its
-- inbox/message exists, and it is over a day old (never races a sync).

create function public.email_attachment_orphans(p_limit integer default 500)
returns table (name text, size bigint)
language sql stable security definer set search_path = '' as $$
  select o.name, (o.metadata->>'size')::bigint
  from storage.objects o
  where o.bucket_id = 'email-attachments'
    and o.created_at < now() - interval '1 day'
    and not exists (
      select 1 from public.email_logs e
      where e.mail_identity_id::text = split_part(o.name, '/', 1)
        and e.provider_message_id = split_part(o.name, '/', 2)
    )
    and not exists (
      select 1 from public.email_logs e,
        jsonb_array_elements(case when jsonb_typeof(e.attachments) = 'array' then e.attachments else '[]'::jsonb end) a
      where a->>'storagePath' = o.name
    )
  order by o.created_at
  limit greatest(0, least(p_limit, 1000));
$$;
revoke execute on function public.email_attachment_orphans(integer) from public, anon, authenticated;
