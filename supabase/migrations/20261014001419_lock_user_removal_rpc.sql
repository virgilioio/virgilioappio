-- Lock the user-removal RPC to the server (2026-10-14).
-- public.safe_delete_user(uuid) is SECURITY DEFINER with no permission check
-- of its own, and anon and authenticated could execute it: anyone holding the
-- app's publishable key could clear any person's profile, memberships,
-- activities and job assignments. The only caller is the delete-user edge
-- function, which checks the caller and since 2026-10-14 calls it with the
-- service role.

revoke all on function public.safe_delete_user(uuid) from public, anon, authenticated;
grant execute on function public.safe_delete_user(uuid) to service_role;
