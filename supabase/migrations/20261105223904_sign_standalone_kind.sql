-- Gio Sign: envelopes with no record (Allan, 2026-11-06), part 1 of 2.
--
-- A fourth kind and source, "standalone" (shown as General): an agreement that belongs to
-- the workspace, not to a candidate, a member or a deal. New enum values can't be used in
-- the transaction that adds them, so the functions that use them are part 2
-- (20261105224022_sign_standalone.sql).

alter type public.sign_kind add value if not exists 'standalone';
alter type public.sign_source add value if not exists 'standalone';
