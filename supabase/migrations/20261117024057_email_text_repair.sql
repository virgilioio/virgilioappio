-- Emails stored with broken characters (2026-11-17, Allan's Go!).
--
-- sync-gmail-messages read each Gmail part with atob() alone, so UTF-8 text was
-- stored as if every byte were a Latin-1 letter: "there’s" became "thereâ€™s", a
-- non-breaking space "Â ", "líneas" "lÃneas". The sync now decodes each part in
-- its own charset (_shared/mailDecode.ts). This repairs what's stored: a body is
-- converted back only when it carries those marks, holds nothing beyond Latin-1
-- (so it is all mis-read bytes) and the bytes form valid UTF-8. Anything else is
-- left as it is. Gmail's snippets were stored HTML-escaped (an apostrophe as the
-- numeric entity 39), and are unescaped the way the sync now does on arrival.
-- Patterns build their semicolon with chr(59), so no string literal holds one.

create or replace function public.email_text_unmangle(_s text)
returns text
language plpgsql
immutable
set search_path = public
as $function$
begin
  if _s is null or _s !~ '(Ã.|Â|â€)' or _s ~ '[^\x01-\xff]' then
    return _s;
  end if;
  return convert_from(convert_to(_s, 'LATIN1'), 'UTF8');
exception when others then
  return _s;
end
$function$;

comment on function public.email_text_unmangle(text) is
  'UTF-8 text that was stored as Latin-1 ("thereâ€™s"), converted back. Anything that isn''t clearly that comes back unchanged.';

create or replace function public.email_snippet_unescape(_s text)
returns text
language plpgsql
immutable
set search_path = public
as $function$
declare
  sc constant text := chr(59);
  out_s text := _s;
  m text[];
  code int;
begin
  if _s is null or _s !~ ('&(#x?[0-9a-fA-F]+|quot|amp|lt|gt|apos|nbsp)' || sc) then
    return _s;
  end if;
  for m in select regexp_matches(_s, '&#([0-9]+)' || sc, 'g') loop
    code := m[1]::int;
    if code between 1 and 1114111 then
      out_s := replace(out_s, '&#' || m[1] || sc, chr(code));
    end if;
  end loop;
  for m in select regexp_matches(_s, '&#[xX]([0-9a-fA-F]+)' || sc, 'g') loop
    code := ('x' || lpad(m[1], 8, '0'))::bit(32)::int;
    if code between 1 and 1114111 then
      out_s := regexp_replace(out_s, '&#[xX]' || m[1] || sc, chr(code), 'g');
    end if;
  end loop;
  out_s := replace(out_s, '&quot' || sc, '"');
  out_s := replace(out_s, '&apos' || sc, chr(39));
  out_s := replace(out_s, '&lt' || sc, '<');
  out_s := replace(out_s, '&gt' || sc, '>');
  out_s := replace(out_s, '&nbsp' || sc, chr(160));
  out_s := replace(out_s, '&amp' || sc, '&');
  return out_s;
exception when others then
  return _s;
end
$function$;

comment on function public.email_snippet_unescape(text) is
  'Gmail''s HTML-escaped snippet as plain text, as sync-gmail-messages now stores it.';

revoke execute on function public.email_text_unmangle(text) from public, anon, authenticated;
revoke execute on function public.email_snippet_unescape(text) from public, anon, authenticated;

update public.email_logs
set body_html = public.email_text_unmangle(body_html),
    body_text = public.email_text_unmangle(body_text)
where (body_html ~ '(Ã.|Â|â€)' and public.email_text_unmangle(body_html) is distinct from body_html)
   or (body_text ~ '(Ã.|Â|â€)' and public.email_text_unmangle(body_text) is distinct from body_text);

update public.email_logs
set snippet = public.email_snippet_unescape(snippet)
where snippet like '%&%'
  and public.email_snippet_unescape(snippet) is distinct from snippet;
