-- Notice period options (2026-10-13, approved by Allan).
-- The new-job wizard added a "Notice period" single-select question with no
-- options, so its dropdown was empty on the public application page. The
-- wizard now ships six options; this gives the same six to the questions it
-- already created. Only empty single-select questions named "Notice period".

insert into public.posting_field_select_options (posting_field_id, option_value, option_label, display_order)
select f.id, o.value, o.label, o.ord
from public.job_posting_application_fields f
cross join (values
  ('immediately', 'Immediately', 0),
  ('1_week', '1 week', 1),
  ('2_weeks', '2 weeks', 2),
  ('1_month', '1 month', 3),
  ('2_months', '2 months', 4),
  ('3_months_plus', '3+ months', 5)
) as o(value, label, ord)
where f.field_type = 'select'
  and lower(btrim(f.field_label)) = 'notice period'
  and not exists (
    select 1 from public.posting_field_select_options x where x.posting_field_id = f.id
  );
