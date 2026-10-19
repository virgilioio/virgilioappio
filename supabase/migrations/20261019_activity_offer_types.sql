-- The offer trail in the candidate's Activity feed, part 1: the new kinds of entry (Allan, 2026-10-19)
--
-- Every step of an offer goes into the in-job Activity feed: created and
-- edited, sent for approval, each approver's decision, recalled, fully
-- approved, and the agreement's life in Gio Sign (sent, opened, signed,
-- declined, voided, expired, reminded, signed by everyone). The entries are
-- written by the database in part 2 (20261019_activity_offer_trail); this
-- part only adds the kinds they need, so part 2 can be tested once these
-- exist (a new kind can't be used in the transaction that adds it).

alter type public.activity_type add value if not exists 'approval_completed';
alter type public.activity_type add value if not exists 'agreement_sent';
alter type public.activity_type add value if not exists 'agreement_opened';
alter type public.activity_type add value if not exists 'agreement_signed';
alter type public.activity_type add value if not exists 'agreement_completed';
alter type public.activity_type add value if not exists 'agreement_declined';
alter type public.activity_type add value if not exists 'agreement_voided';
alter type public.activity_type add value if not exists 'agreement_expired';
alter type public.activity_type add value if not exists 'agreement_reminded';
