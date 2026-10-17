-- Run after 20261017070000_sign_offer_values inside a transaction that is rolled back.
-- Every row's ok is true.
select 'salary json' as check, public.sign_offer_display('salary', '{"amount":"100000","currency":"MXN"}', null, null) = 'MXN 100,000' as ok
union all select 'salary decimals', public.sign_offer_display('salary', '{"amount":"1234.5","currency":"USD"}', null, null) = 'USD 1,234.50'
union all select 'salary currency from config', public.sign_offer_display('salary', '{"amount":"66000"}', '{"currency":"USD","period":"annually"}', null) = 'USD 66,000'
union all select 'salary empty amount', public.sign_offer_display('salary', '{"amount":"","currency":"MXN"}', null, null) is null
union all select 'salary plain number', public.sign_offer_display('salary', '5000', '{"currency":"MXN"}', null) = 'MXN 5,000'
union all select 'location json', public.sign_offer_display('location', '{"city":"Zapopan","state":"Jalisco","country":"Mexico"}', null, null) = 'Zapopan, Jalisco, Mexico'
union all select 'date', public.sign_offer_display('date', '2026-10-26', null, null) = 'October 26, 2026'
union all select 'employment type', public.sign_offer_display('employment_type', 'full_time', null, null) = 'Full-time'
union all select 'work location', public.sign_offer_display('work_location', 'onsite', null, null) = 'On-site'
union all select 'checkbox', public.sign_offer_display('checkbox', 'true', null, null) = 'Yes'
union all select 'unknown json never raw', public.sign_offer_display('text', '{"amount":"10","currency":"MXN"}', null, null) = 'MXN 10'
union all select 'blank is null', public.sign_offer_display('text', '   ', null, null) is null
union all select 'offer values: no JSON in any value',
  not exists (
    select 1 from public.offer_letters o, jsonb_each_text(public.sign_offer_values(o.id)->'values') e
    where e.value ~ '^\s*[\{\[]')
union all select 'offer values: base salary formatted',
  coalesce((select bool_and(public.sign_offer_values(o.id)->'values'->>'base_salary' ~ '^[A-Z]{3} [0-9,]+(\.[0-9]{2})?$')
            from public.offer_letters o where o.field_values ? 'base_salary' and o.field_values->>'base_salary' like '%amount%'), true)
union all select 'offer values: labels from the form',
  coalesce((select bool_and(public.sign_offer_values(o.id)->'labels' ? 'job_title')
            from public.offer_letters o where o.field_values ? 'job_title'), true)
union all select 'record values not callable by signed-in users',
  not has_function_privilege('authenticated', 'public.sign_record_values(sign_source, uuid, uuid)', 'execute')
union all select 'offer helpers not callable by signed-in users',
  not has_function_privilege('authenticated', 'public.sign_offer_values(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.sign_offer_display(text, text, jsonb, uuid)', 'execute')
union all select 'preview still callable', has_function_privilege('authenticated', 'public.sign_send_preview(uuid, sign_source, uuid, uuid)', 'execute');
