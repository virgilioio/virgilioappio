import { cn } from '@/lib/utils'

const CHANNEL_COLOR: Record<string, string> = {
  in_app: '#6F3FF5',
  inapp: '#6F3FF5',
  email: '#2563EB',
  whatsapp: '#12B886',
}

interface ChannelDotProps {
  channel: string | null | undefined
  className?: string
}

/**
 * ChannelDot — small colored dot overlaid on an avatar to indicate the
 * conversation's channel (in-app / email / whatsapp).
 */
export function ChannelDot({ channel, className }: ChannelDotProps) {
  const color = CHANNEL_COLOR[channel ?? 'in_app'] ?? '#6F3FF5'
  return (
    <span
      aria-hidden
      className={cn(
        'absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white',
        className,
      )}
      style={{ backgroundColor: color }}
    />
  )
}
