import { MoreHorizontal, Info, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconTip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type IntegrationState = 'connected' | 'attention' | 'off'

const ICON_BTN =
  'gio-pressable inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#6B7080] transition-colors duration-hover hover:bg-[#F1F0EC] hover:text-[#1F2230]'

/**
 * One integration (2026-10-27): its logo, whether it's connected (a green
 * dot) or needs attention (amber), what it does, then its actions: Connect
 * when it isn't, Configure when it is, Details always, and Disconnect last in
 * the ⋯ menu. The card itself isn't a button; its actions are.
 */
export function IntegrationCard({
  name,
  description,
  logo,
  state,
  primary,
  note,
  onDetails,
  onDisconnect,
}: {
  name: string
  description: string
  logo: React.ReactNode
  state: IntegrationState
  /** Connect / Configure / Get extension… (none: `note` explains why). */
  primary?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary'; loading?: boolean }
  note?: string
  onDetails: () => void
  onDisconnect?: () => void
}) {
  return (
    <article className="flex min-h-[188px] flex-col rounded-xl border border-[#E7E8EE] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] border border-[#EFEEEA] bg-[#FAFAF7]">
          {logo}
        </span>
        <StateLabel state={state} />
      </div>
      <h4 className="mt-3 truncate font-poppins text-[14px] font-semibold tracking-[-0.01em] text-text-primary">{name}</h4>
      <p className="mt-1 line-clamp-2 font-inter text-[12.5px] leading-[1.5] text-text-secondary">{description}</p>
      <div className="mt-auto flex items-center gap-1.5 pt-4">
        {primary ? (
          <Button size="sm" variant={primary.variant ?? (state === 'off' ? 'primary' : 'secondary')} loading={primary.loading} onClick={primary.onClick}>
            {primary.label}
          </Button>
        ) : (
          note && <span className="min-w-0 truncate font-inter text-[12px] text-text-tertiary">{note}</span>
        )}
        <Button size="sm" variant="ghost" onClick={onDetails}>
          Details
        </Button>
        {onDisconnect && (
          <DropdownMenu>
            <IconTip label={`${name} actions`}>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={`${name} actions`} className={cn(ICON_BTN, 'ml-auto')}>
                  <MoreHorizontal size={15} />
                </button>
              </DropdownMenuTrigger>
            </IconTip>
            <DropdownMenuContent align="end" className="w-[220px]">
              <DropdownMenuItem onSelect={onDetails}>
                <Info />
                <span className="truncate">Details</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-danger onSelect={onDisconnect}>
                <Unplug />
                <span className="truncate">Disconnect</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </article>
  )
}

export function StateLabel({ state }: { state: IntegrationState }) {
  if (state === 'off') return null
  const attention = state === 'attention'
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-inter text-[12px] font-medium', attention ? 'text-[#9A5B07]' : 'text-[#0E7A4D]')}>
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', attention ? 'bg-[#E59E1B]' : 'bg-[#12B886]')} />
      {attention ? 'Needs attention' : 'Connected'}
    </span>
  )
}
