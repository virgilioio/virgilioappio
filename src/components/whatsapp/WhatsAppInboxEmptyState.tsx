import { MessageSquare, WifiOff, QrCode, Loader2, RefreshCw, AlertCircle, Inbox, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import type { WhatsAppSessionStatus } from '@/hooks/useWhatsAppConfig'
import gioEmpty from '@/assets/gio-empty-state.png'

interface WhatsAppInboxEmptyStateProps {
  sessionStatus: WhatsAppSessionStatus
  context?: 'inbox' | 'candidate' | 'job'
  candidateName?: string
  onConnect?: () => void
  onReconnect?: () => void
  className?: string
}

interface StateConfig {
  icon: typeof MessageSquare
  title: string
  description: string
  actionLabel?: string
  actionVariant?: 'default' | 'outline'
  showGioImage?: boolean
  useNavigateToSettings?: boolean
}

function getStateConfig(
  status: WhatsAppSessionStatus,
  context: string,
  candidateName?: string
): StateConfig {
  switch (status) {
    case 'disconnected':
      return {
        icon: WifiOff,
        title: 'WhatsApp not connected',
        description: context === 'candidate'
          ? `Connect your WhatsApp in Settings to see conversations with ${candidateName || 'this candidate'}.`
          : 'Connect your WhatsApp to start syncing conversations with candidates.',
        actionLabel: 'Connect WhatsApp',
        useNavigateToSettings: true,
        showGioImage: context === 'job',
      }
    case 'waiting_for_qr':
      return {
        icon: QrCode,
        title: 'Waiting for QR scan',
        description: 'Open WhatsApp on your phone and scan the QR code in Settings to complete the connection.',
        actionLabel: 'Go to Settings',
        actionVariant: 'outline',
        useNavigateToSettings: true,
      }
    case 'connecting':
      return {
        icon: Loader2,
        title: 'Connecting to WhatsApp…',
        description: 'Establishing your WhatsApp connection. This usually takes a few seconds.',
      }
    case 'syncing':
      return {
        icon: Loader2,
        title: 'Syncing conversations…',
        description: 'Importing your WhatsApp conversations. They will appear here shortly.',
      }
    case 'reconnect_required':
      return {
        icon: RefreshCw,
        title: 'Reconnection needed',
        description: 'Your WhatsApp session was disconnected. Reconnect in Settings to resume syncing.',
        actionLabel: 'Reconnect',
        useNavigateToSettings: true,
      }
    case 'expired':
      return {
        icon: AlertCircle,
        title: 'Session expired',
        description: 'Your WhatsApp session has expired. Please reconnect to continue syncing conversations.',
        actionLabel: 'Reconnect',
        useNavigateToSettings: true,
      }
    case 'error':
      return {
        icon: AlertCircle,
        title: 'Connection error',
        description: 'Something went wrong with your WhatsApp connection. Please try reconnecting.',
        actionLabel: 'Go to Settings',
        actionVariant: 'outline',
        useNavigateToSettings: true,
      }
    case 'connected':
    default:
      return {
        icon: Inbox,
        title: context === 'candidate'
          ? `No WhatsApp messages with ${candidateName || 'this candidate'} yet`
          : 'No conversations yet',
        description: context === 'candidate'
          ? 'Messages will appear here once synced from your connected WhatsApp.'
          : 'Your WhatsApp is connected. Conversations will appear here as they sync.',
        showGioImage: context === 'job',
      }
  }
}

export function WhatsAppInboxEmptyState({
  sessionStatus,
  context = 'inbox',
  candidateName,
  onConnect,
  onReconnect,
  className,
}: WhatsAppInboxEmptyStateProps) {
  const navigate = useNavigate()
  const config = getStateConfig(sessionStatus, context, candidateName)
  const Icon = config.icon
  const isAnimated = sessionStatus === 'connecting' || sessionStatus === 'syncing'

  const handleAction = () => {
    if (sessionStatus === 'reconnect_required' || sessionStatus === 'expired') {
      onReconnect?.()
    } else if (sessionStatus === 'disconnected' || sessionStatus === 'error') {
      onConnect?.()
    }
    if (config.useNavigateToSettings) {
      navigate('/settings?tab=integrations')
    }
  }

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center px-6',
      context === 'candidate' ? 'py-12' : 'py-20',
      className
    )}>
      {config.showGioImage ? (
        <img src={gioEmpty} alt="" className="h-24 w-24 mb-4 opacity-80" />
      ) : (
        <div className={cn(
          'h-12 w-12 rounded-full flex items-center justify-center mb-4',
          sessionStatus === 'connected' || sessionStatus === 'syncing'
            ? 'bg-[#25D366]/10'
            : sessionStatus === 'error' || sessionStatus === 'expired'
            ? 'bg-destructive/10'
            : 'bg-muted'
        )}>
          <Icon className={cn(
            'h-6 w-6',
            sessionStatus === 'connected' || sessionStatus === 'syncing'
              ? 'text-[#25D366]'
              : sessionStatus === 'error' || sessionStatus === 'expired'
              ? 'text-destructive'
              : 'text-muted-foreground',
            isAnimated && 'animate-spin'
          )} />
        </div>
      )}

      <p className={cn(
        'font-semibold text-foreground',
        context === 'candidate' ? 'text-sm' : 'text-base'
      )}>
        {config.title}
      </p>
      <p className={cn(
        'text-muted-foreground mt-1',
        context === 'candidate' ? 'text-xs max-w-[240px]' : 'text-sm max-w-xs'
      )}>
        {config.description}
      </p>

      {config.actionLabel && (
        <Button
          variant={config.actionVariant || 'default'}
          size="sm"
          className={cn(
            'mt-4',
            !config.actionVariant && 'bg-[#25D366] hover:bg-[#25D366]/90 text-white'
          )}
          onClick={handleAction}
        >
          {config.actionLabel}
        </Button>
      )}
    </div>
  )
}

/**
 * Compact empty state for no conversations yet (when connected).
 * Used inside conversation lists.
 */
export function WhatsAppNoConversationsState({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center px-4', className)}>
      <div className="h-10 w-10 rounded-full bg-[#25D366]/10 flex items-center justify-center mb-3">
        <MessageSquare className="h-5 w-5 text-[#25D366]" />
      </div>
      <p className="text-sm font-medium text-foreground">No conversations synced yet</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
        Conversations from your WhatsApp will appear here as they sync.
      </p>
    </div>
  )
}
