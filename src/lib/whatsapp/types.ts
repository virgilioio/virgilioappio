/**
 * WhatsApp Provider Integration — Normalized Data Contracts
 * 
 * These types define GoGio's internal WhatsApp model.
 * All provider-specific payloads are normalized into these shapes
 * before reaching the ATS layer.
 */

// ─── Session ────────────────────────────────────────────────

export type WhatsAppSessionStatus =
  | 'disconnected'
  | 'waiting_for_qr'
  | 'connecting'
  | 'connected'
  | 'syncing'
  | 'reconnect_required'
  | 'expired'
  | 'error'

export interface WhatsAppSession {
  id: string
  tenantId: string
  provider: string
  providerSessionId: string | null
  sessionStatus: WhatsAppSessionStatus
  connectedPhone: string | null
  connectedAt: string | null
  disconnectedAt: string | null
  lastSyncAt: string | null
  lastError: string | null
  conversationCount: number
  qrCodeData: string | null
  qrExpiresAt: string | null
  providerMetadata: Record<string, unknown>
}

// ─── Conversation ───────────────────────────────────────────

export type ConversationLinkStatus =
  | 'linked'
  | 'unlinked'
  | 'multiple_matches'
  | 'pending_review'

export interface WhatsAppConversation {
  id: string
  tenantId: string
  providerChatId: string | null
  phoneNumber: string
  displayName: string | null
  candidateId: string | null
  jobId: string | null
  isManuallyLinked: boolean
  linkedAt: string | null
  linkedBy: string | null
  lastMessageAt: string | null
  lastMessagePreview: string | null
  unreadCount: number
  syncStatus: string
  providerMetadata: Record<string, unknown>
  createdAt: string
}

// ─── Message ────────────────────────────────────────────────

export type MessageDirection = 'inbound' | 'outbound'

export type MessageStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'synced' // pulled from provider history

export interface WhatsAppMessage {
  id: string
  conversationId: string
  tenantId: string
  candidateId: string | null
  jobId: string | null
  providerMessageId: string | null
  direction: MessageDirection
  body: string
  fromPhone: string
  toPhone: string
  senderId: string | null
  senderName: string | null
  status: MessageStatus
  mediaType: string | null
  mediaUrl: string | null
  providerTimestamp: string | null
  providerMetadata: Record<string, unknown>
  createdAt: string
}

// ─── Candidate Match ────────────────────────────────────────

export type CandidateMatchType = 'exact' | 'suffix' | 'fuzzy'

export interface CandidatePhoneMatch {
  candidateId: string
  candidateName: string
  phone: string | null
  email: string | null
  currentJobTitle: string | null
  matchType: CandidateMatchType
}

// ─── Provider Adapter Interface ─────────────────────────────

/**
 * Provider-agnostic adapter interface.
 * Each WhatsApp provider (Evolution API, Baileys, etc.)
 * implements this interface via an edge function layer.
 * 
 * The frontend NEVER calls these directly — they are invoked
 * through edge functions that normalize payloads.
 */
export interface WhatsAppProviderAdapter {
  /** Initiate a new session and return QR code data */
  connectSession(tenantId: string): Promise<{
    providerSessionId: string
    qrCodeData: string
    qrExpiresAt: string
  }>

  /** Terminate an active session */
  disconnectSession(tenantId: string, providerSessionId: string): Promise<void>

  /** Poll or retrieve current session status */
  getSessionStatus(tenantId: string, providerSessionId: string): Promise<{
    status: WhatsAppSessionStatus
    connectedPhone?: string
  }>

  /** Pull conversations from the provider */
  syncConversations(tenantId: string, providerSessionId: string): Promise<ProviderConversation[]>

  /** Pull messages for a specific conversation */
  syncMessages(
    tenantId: string,
    providerSessionId: string,
    providerChatId: string,
    since?: string
  ): Promise<ProviderMessage[]>
}

// ─── Raw Provider Payloads (pre-normalization) ──────────────

/** Raw conversation as received from a provider, before normalization */
export interface ProviderConversation {
  providerChatId: string
  phoneNumber: string
  displayName: string | null
  lastMessageAt: string | null
  lastMessagePreview: string | null
  unreadCount: number
  metadata: Record<string, unknown>
}

/** Raw message as received from a provider, before normalization */
export interface ProviderMessage {
  providerMessageId: string
  providerChatId: string
  direction: MessageDirection
  body: string
  fromPhone: string
  toPhone: string
  senderName: string | null
  timestamp: string
  status: MessageStatus
  mediaType: string | null
  mediaUrl: string | null
  metadata: Record<string, unknown>
}
