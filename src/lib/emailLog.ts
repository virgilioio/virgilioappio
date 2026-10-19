import { supabase } from '@/integrations/supabase/client'
import type { EmailHistoryCardEmail } from '@/components/candidates/EmailHistoryCard'

/**
 * One message from email_logs in the shape the composer's Reply and Forward
 * take (formatQuotedReply / formatForwardedMessage). The Activity feed only
 * carries a short version of each email, so Reply and Forward there read the
 * full message first. Null when it's gone or out of reach.
 */
export async function fetchEmailForReply(emailLogId: string): Promise<EmailHistoryCardEmail | null> {
  const { data, error } = await supabase
    .from('email_logs')
    .select(
      'id, direction, from_address, to_addresses, cc_addresses, bcc_addresses, subject, body_html, body_text, snippet, status, created_at, sent_at, received_at, opened_at, clicked_at, replied_at, error_message',
    )
    .eq('id', emailLogId)
    .maybeSingle()
  if (error || !data) return null
  return data as unknown as EmailHistoryCardEmail
}
