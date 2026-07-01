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
 * ChannelDot — 13×13 white circle punched into the avatar corner,
 * containing an 8px colored dot indicating the conversation channel.
 */
export function ChannelDot({ channel, className }: ChannelDotProps) {
  const color = CHANNEL_COLOR[channel ?? 'in_app'] ?? '#6F3FF5'
  return (
    <span
      aria-hidden
      className={cn(
        'absolute -bottom-px -right-px flex h-[13px] w-[13px] items-center justify-center rounded-full bg-white',
        className,
      )}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  )
}
