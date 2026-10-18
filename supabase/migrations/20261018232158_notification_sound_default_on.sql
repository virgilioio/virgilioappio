-- The notification sound is on by default (Allan, 2026-10-18). "Play a sound"
-- (sound_on_mention) never played anything before today, so a saved "off" was
-- never a real choice: everyone starts with it on, and anyone can turn it off
-- in the bell's preferences or Settings. New rows default to on.
alter table public.notification_preferences alter column sound_on_mention set default true;
update public.notification_preferences set sound_on_mention = true where sound_on_mention is not true;
