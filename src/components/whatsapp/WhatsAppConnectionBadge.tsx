import { Wifi, WifiOff, QrCode, Loader2, AlertCircle, RefreshCw, CloudOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { WhatsAppSessionStatus } from '@/hooks/useWhatsAppConfig'

interface WhatsAppConnectionBadgeProps {
  status: WhatsAppSessionStatus
  className?: string
  size?: 'sm' | 'md'
}

const STATUS_CONFIG: Record<WhatsAppSessionStatus, {
  icon: typeof Wifi
  label: string
  badgeClass: string
}> = {
  disconnected: {
    icon: WifiOff,
    label: 'Not connected',
    badgeClass: 'border-muted-foreground/30 text-muted-foreground',
  },
  waiting_for_qr: {
    icon: QrCode,
    label: 'Scan QR',
    badgeClass: 'border-amber-500/30 text-amber-600 dark:text-amber-400',
  },
  connecting: {
    icon: Loader2,
    label: 'Connecting…',
    badgeClass: 'border-amber-500/30 text-amber-600 dark:text-amber-400',
  },
  connected: {
    icon: Wifi,
    label: 'Connected',
    badgeClass: 'border-[#25D366]/30 text-[#25D366]',
  },
  syncing: {
    icon: Loader2,
    label: 'Syncing…',
    badgeClass: 'border-[#25D366]/30 text-[#25D366]',
  },
  reconnect_required: {
    icon: RefreshCw,
    label: 'Reconnect',
    badgeClass: 'border-amber-500/30 text-amber-600 dark:text-amber-400',
  },
  expired: {
    icon: CloudOff,
    label: 'Expired',
    badgeClass: 'border-destructive/30 text-destructive',
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    badgeClass: 'border-destructive/30 text-destructive',
  },
}

export function WhatsAppConnectionBadge({ status, className, size = 'sm' }: WhatsAppConnectionBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  const isAnimated = status === 'connecting' || status === 'syncing'

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium gap-1',
        size === 'sm' ? 'text-[10px]' : 'text-xs',
        config.badgeClass,
        className
      )}
    >
      <Icon className={cn(
        size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3',
        isAnimated && 'animate-spin'
      )} />
      {config.label}
    </Badge>
  )
}

/**
 * Simple dot indicator for connection status.
 * Use in compact contexts (chat headers, conversation list items).
 */
export function WhatsAppStatusDot({ status, className }: { status: WhatsAppSessionStatus; className?: string }) {
  const colorClass = (() => {
    switch (status) {
      case 'connected':
      case 'syncing':
        return 'bg-[#25D366]'
      case 'waiting_for_qr':
      case 'connecting':
      case 'reconnect_required':
        return 'bg-amber-500'
      case 'expired':
      case 'error':
        return 'bg-destructive'
      default:
        return 'bg-muted-foreground'
    }
  })()

  return (
    <div className={cn(
      'h-2 w-2 rounded-full',
      colorClass,
      (status === 'connecting' || status === 'syncing') && 'animate-pulse',
      className
    )} />
  )
}
