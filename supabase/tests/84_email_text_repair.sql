-- Run after 20261117024057_email_text_repair inside a transaction that is rolled back.
-- Bodies stored as Latin-1 come back as the UTF-8 they were, anything else is left
-- alone, and Gmail's escaped snippets read as text. Every row's ok is true.
-- pg_temp.sc() writes a semicolon where the text has a broken bar, so no string
-- literal holds one.
create temp table t_results (check_name text, ok boolean);

create or replace function pg_temp.sc(_s text)
returns text
language sql
as $$ select replace(_s, '¦', chr(59)) $$;

do $$
declare
  mangle text;
  good text := 'Yes, there’s a change. We’d love that. Hey Allen,' || chr(160) || ' Imagen entre líneas';
begin
  -- What the old sync stored: the UTF-8 bytes read one by one as Latin-1.
  mangle := convert_from(convert_to(good, 'UTF8'), 'LATIN1');
  insert into t_results values ('the test text is mangled the old way', mangle like '%thereâ%' and mangle like '%lÃ%');
  insert into t_results values ('mangled text comes back right', public.email_text_unmangle(mangle) = good);
  insert into t_results values ('correct text is left alone', public.email_text_unmangle(good) = good);
  insert into t_results values ('plain ASCII is left alone', public.email_text_unmangle('Hello there') = 'Hello there');
  insert into t_results values ('real Latin letters are left alone', public.email_text_unmangle('Café en Bogotá, Señor Ñandú') = 'Café en Bogotá, Señor Ñandú');
  insert into t_results values ('a word with a real Ã is left alone', public.email_text_unmangle('SÃO PAULO office') = 'SÃO PAULO office');
  insert into t_results values ('mixed right and wrong is left alone', public.email_text_unmangle('’ and ' || mangle) = '’ and ' || mangle);
  insert into t_results values ('null stays null', public.email_text_unmangle(null) is null);
  insert into t_results values ('HTML with tags comes back right',
    public.email_text_unmangle(convert_from(convert_to('<p>Hey Allen,' || chr(160) || '</p><p>we’d</p>', 'UTF8'), 'LATIN1')) = '<p>Hey Allen,' || chr(160) || '</p><p>we’d</p>');

  insert into t_results values ('snippet: a numeric apostrophe', public.email_snippet_unescape(pg_temp.sc('Yes, there&#39¦s a change')) = 'Yes, there''s a change');
  insert into t_results values ('snippet: named and hex', public.email_snippet_unescape(pg_temp.sc('&quot¦A&quot¦ &amp¦ B &lt¦3 &#x2019¦')) = '"A" & B <3 ’');
  insert into t_results values ('snippet: an escaped ampersand stays literal once', public.email_snippet_unescape(pg_temp.sc('a &amp¦lt¦ b')) = pg_temp.sc('a &lt¦ b'));
  insert into t_results values ('snippet: plain text untouched', public.email_snippet_unescape(pg_temp.sc('Fish &chips¦ stays')) = pg_temp.sc('Fish &chips¦ stays'));
  insert into t_results values ('snippet: null', public.email_snippet_unescape(null) is null);

  -- After the migration's updates, nothing that can be repaired is left.
  insert into t_results values ('no repairable body left',
    not exists (select 1 from public.email_logs
                where public.email_text_unmangle(body_html) is distinct from body_html
                   or public.email_text_unmangle(body_text) is distinct from body_text));
  insert into t_results values ('no escaped snippet left',
    not exists (select 1 from public.email_logs where public.email_snippet_unescape(snippet) is distinct from snippet));
  insert into t_results values ('browsers can''t call the helpers',
    not has_function_privilege('authenticated', 'public.email_text_unmangle(text)', 'execute')
    and not has_function_privilege('anon', 'public.email_snippet_unescape(text)', 'execute'));
end $$;

select * from t_results;
