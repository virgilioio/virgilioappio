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

// ─── Session State Machine ──────────────────────────────────

export interface WhatsAppSessionState {
  status: WhatsAppSessionStatus
  label: string
  description: string
  canSync: boolean
  canMessage: boolean
  actionLabel: string | null
  actionType: 'connect' | 'reconnect' | 'disconnect' | null
}

const SESSION_STATES: Record<WhatsAppSessionStatus, Omit<WhatsAppSessionState, 'status'>> = {
  disconnected: {
    label: 'Not connected',
    description: 'Connect your WhatsApp to start syncing conversations with candidates.',
    canSync: false, canMessage: false,
    actionLabel: 'Connect WhatsApp', actionType: 'connect',
  },
  waiting_for_qr: {
    label: 'Scan QR code',
    description: 'Open WhatsApp on your phone and scan the QR code to connect.',
    canSync: false, canMessage: false,
    actionLabel: null, actionType: null,
  },
  connecting: {
    label: 'Connecting…',
    description: 'Establishing connection with WhatsApp. This usually takes a few seconds.',
    canSync: false, canMessage: false,
    actionLabel: null, actionType: null,
  },
  connected: {
    label: 'Connected',
    description: 'Your WhatsApp is connected and conversations are being synced.',
    canSync: true, canMessage: true,
    actionLabel: 'Disconnect', actionType: 'disconnect',
  },
  syncing: {
    label: 'Syncing…',
    description: 'Importing your WhatsApp conversations. This may take a few minutes.',
    canSync: true, canMessage: false,
    actionLabel: null, actionType: null,
  },
  reconnect_required: {
    label: 'Reconnect required',
    description: 'Your WhatsApp session was disconnected. Please reconnect to resume syncing.',
    canSync: false, canMessage: false,
    actionLabel: 'Reconnect', actionType: 'reconnect',
  },
  expired: {
    label: 'Session expired',
    description: 'Your WhatsApp session has expired. Please reconnect to continue.',
    canSync: false, canMessage: false,
    actionLabel: 'Reconnect', actionType: 'reconnect',
  },
  error: {
    label: 'Connection error',
    description: 'Something went wrong with your WhatsApp connection. Please try again.',
    canSync: false, canMessage: false,
    actionLabel: 'Retry connection', actionType: 'connect',
  },
}

export function getWhatsAppSessionState(status: WhatsAppSessionStatus): WhatsAppSessionState {
  return { status, ...SESSION_STATES[status] }
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
