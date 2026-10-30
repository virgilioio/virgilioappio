/** A Google connection that needs reconnecting. Kept in step with the
 * database's os_google_broken (the profile check). */
export function hasTokenFailure(identity: { sync_status?: string | null; sync_error?: string | null; sync_error_message?: string | null; is_active?: boolean }) {
  const status = (identity.sync_status || '').toLowerCase()
  const message = `${identity.sync_error || ''} ${identity.sync_error_message || ''}`.toLowerCase()
  return (
    identity.is_active === false ||
    status === 'expired' ||
    status === 'error' ||
    status === 'auth_required' ||
    message.includes('token') ||
    message.includes('revoked') ||
    message.includes('refresh') ||
    message.includes('invalid_grant')
  )
}
