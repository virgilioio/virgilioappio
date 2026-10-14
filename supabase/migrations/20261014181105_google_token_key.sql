-- Google refresh tokens get a real secret key (2026-10-14, approved by Allan).
--
-- Until now encrypt/decrypt_refresh_token fell back to a fixed key written in
-- the code ('default-encryption-key-change-in-production') because
-- app.encryption_key was never set, so the encryption protected nothing.
-- This migration:
--   1. creates a random 32-byte key in Supabase Vault (generated here, so it
--      never appears in the repo or in any log),
--   2. re-encrypts every stored Google refresh token (mail and calendar) with
--      it, in this same transaction,
--   3. switches both functions to the Vault key. Decryption still accepts the
--      old fixed key as a fallback, only so a token written by an in-flight
--      sign-in during the switch keeps working; every stored token uses the
--      new key after this runs.
-- Nobody outside the database can read the key: the helper that fetches it is
-- callable only by the database itself.

select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'google_refresh_token_key',
  'Encrypts Google refresh tokens (user_mail_identities, calendar_identities). Never export.'
);

create or replace function public.google_token_key()
returns text
language sql
stable
security definer
set search_path to 'public', 'vault'
as $function$
  select decrypted_secret from vault.decrypted_secrets where name = 'google_refresh_token_key' limit 1;
$function$;

revoke execute on function public.google_token_key() from public, anon, authenticated, service_role;

-- Re-encrypt what is stored today (old fixed key -> Vault key).
update public.user_mail_identities
set refresh_token_encrypted = encode(
  extensions.pgp_sym_encrypt(
    extensions.pgp_sym_decrypt(decode(refresh_token_encrypted, 'base64'), 'default-encryption-key-change-in-production'),
    public.google_token_key()
  ),
  'base64'
)
where refresh_token_encrypted is not null;

update public.calendar_identities
set encrypted_refresh_token = encode(
  extensions.pgp_sym_encrypt(
    extensions.pgp_sym_decrypt(decode(encrypted_refresh_token, 'base64'), 'default-encryption-key-change-in-production'),
    public.google_token_key()
  ),
  'base64'
)
where encrypted_refresh_token is not null;

create or replace function public.encrypt_refresh_token(token text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  k text := public.google_token_key();
begin
  if k is null then
    raise exception 'The Google token key is missing from Vault.' using errcode = 'GOS05';
  end if;
  return encode(pgp_sym_encrypt(token, k), 'base64');
end;
$function$;

create or replace function public.decrypt_refresh_token(encrypted_token text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if encrypted_token is null then
    return null;
  end if;

  -- Only the server, the token's owner or a platform admin (hotfix 2026-10-14).
  if coalesce(auth.role(), '') <> 'service_role'
     and public.get_user_type_secure() is distinct from 'platform_admin'
     and not exists (
       select 1 from public.user_mail_identities
       where user_id = auth.uid() and refresh_token_encrypted = encrypted_token
     )
     and not exists (
       select 1 from public.calendar_identities
       where user_id = auth.uid() and encrypted_refresh_token = encrypted_token
     )
  then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  begin
    return pgp_sym_decrypt(decode(encrypted_token, 'base64'), public.google_token_key());
  exception when others then
    -- Written with the old fixed key during the switch.
    return pgp_sym_decrypt(decode(encrypted_token, 'base64'), 'default-encryption-key-change-in-production');
  end;
end;
$function$;

revoke execute on function public.encrypt_refresh_token(text) from public, anon, authenticated;
grant execute on function public.encrypt_refresh_token(text) to service_role;
revoke execute on function public.decrypt_refresh_token(text) from public, anon;
grant execute on function public.decrypt_refresh_token(text) to authenticated, service_role;
