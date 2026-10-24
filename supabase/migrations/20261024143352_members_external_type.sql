-- External users (Allan, 2026-10-24): customers who use Gio ATS as hiring
-- managers or interviewers. A new user type of its own; the rules that use it
-- come in the next migration, since a new enum value can't be used in the
-- transaction that adds it.
alter type public.user_type_enum add value if not exists 'external';
