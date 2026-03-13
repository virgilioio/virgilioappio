/**
 * WhatsApp Provider Normalizers
 * 
 * Transforms raw provider payloads into GoGio's internal
 * normalized data shapes. Used by edge functions during sync.
 */

import type {
  ProviderConversation,
  ProviderMessage,
} from './types'

/**
 * Normalize a phone number by stripping non-digit characters.
 * Used for consistent phone-based matching across the system.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '')
}

/**
 * Check if two phone numbers are equivalent.
 * Supports exact match and suffix match (last 10 digits)
 * to handle country code variations.
 */
export function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  if (na === nb) return true
  if (na.length >= 10 && nb.length >= 10) {
    return na.slice(-10) === nb.slice(-10)
  }
  return false
}

/**
 * Convert a provider conversation into the shape needed
 * for upserting into whatsapp_conversations.
 */
export function normalizeConversationForDb(
  tenantId: string,
  conv: ProviderConversation
) {
  return {
    tenant_id: tenantId,
    provider_chat_id: conv.providerChatId,
    phone_number: conv.phoneNumber,
    display_name: conv.displayName,
    last_message_at: conv.lastMessageAt,
    last_message_preview: conv.lastMessagePreview,
    unread_count: conv.unreadCount,
    sync_status: 'synced',
    provider_metadata: conv.metadata,
  }
}

/**
 * Convert a provider message into the shape needed
 * for upserting into whatsapp_messages.
 */
export function normalizeMessageForDb(
  tenantId: string,
  conversationId: string,
  candidateId: string | null,
  jobId: string | null,
  msg: ProviderMessage
) {
  return {
    tenant_id: tenantId,
    conversation_id: conversationId,
    candidate_id: candidateId,
    job_id: jobId,
    provider_message_id: msg.providerMessageId,
    direction: msg.direction,
    body: msg.body,
    from_phone: msg.fromPhone,
    to_phone: msg.toPhone,
    sender_name: msg.senderName,
    status: msg.status,
    media_type: msg.mediaType,
    media_url: msg.mediaUrl,
    provider_timestamp: msg.timestamp,
    provider_metadata: msg.metadata,
  }
}
