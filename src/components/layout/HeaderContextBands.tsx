import { ChevronRight, Shield, UserRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IconTip } from '@/components/ui/tooltip'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { useProfileInvite } from '@/components/os/profileChecks'

/**
 * Stackable context bands rendered directly under the top Header: the
 * Platform admin band (desktop only) and, until your profile is complete, the
 * My profile band (Allan, 2026-10-26). Gio ATS is no longer sold, so the
 * trial and billing bands are gone (2026-10-24).
 * Each band is dismissible; dismissal persists for the session.
 */

const DISMISS_KEY = 'header-context-bands-dismissed'

function useDismissed() {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(DISMISS_KEY) || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed))
  }, [dismissed])

  return {
    isDismissed: (key: string) => !!dismissed[key],
    dismiss: (key: string) => setDismissed((d) => ({ ...d, [key]: true })),
  }
}

export function HeaderContextBands() {
  const { userType } = useAuth()
  const { isDismissed, dismiss } = useDismissed()

  const isPlatformAdmin = userType === 'platform_admin'

  const showAdmin = isPlatformAdmin && !isDismissed('admin')
  const invite = useProfileInvite()
  const showProfile = invite.showBand && !isDismissed('profile')
  if (!showAdmin && !showProfile) return null

  const first = invite.missing[0]
  const still = invite.missing.map((c) => c.inline)
  const stillText = still.length > 1 ? `${still.slice(0, -1).join(', ')} and ${still[still.length - 1]}` : still[0]

  return (
    <div className="flex flex-col gap-2 fixed top-[calc(env(safe-area-inset-top,0px)+66px)] left-3 right-3 sm:top-[3.75rem] sm:left-[5.5rem] sm:right-3 z-40 pointer-events-none">
      {showAdmin && (
        <Band tone="lilac" onDismiss={() => dismiss('admin')} className="pointer-events-auto hidden sm:flex">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          <span className="font-poppins font-medium text-[12.5px] tracking-[-0.01em]">
            Platform Admin
          </span>
          <span className="text-[12px] text-virgilio-purple/80 hidden md:inline">
            Viewing data across all organizations
          </span>
        </Band>
      )}
      {showProfile && first && (
        <Band tone="lilac" onDismiss={() => dismiss('profile')} className="pointer-events-auto">
          <UserRound className="h-3.5 w-3.5 shrink-0" />
          <span className="font-poppins font-medium text-[12.5px] tracking-[-0.01em] whitespace-nowrap">
            Your profile is <span className="tabular-nums">{invite.done} of {invite.total}</span> done
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-virgilio-purple/80 hidden md:inline">
            Still to add: {stillText}.
          </span>
          <Link
            to={first.to}
            className="gio-pressable ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-virgilio-purple pl-2.5 pr-1.5 font-inter text-[12px] font-medium text-white whitespace-nowrap transition-colors duration-hover hover:bg-virgilio-purple/90"
          >
            Finish profile
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Band>
      )}
    </div>
  )
}

function Band({
  children,
  tone,
  className,
  onDismiss,
}: {
  children: React.ReactNode
  tone: 'lilac' | 'amber'
  className?: string
  onDismiss?: () => void
}) {
  const styles =
    tone === 'lilac'
      ? 'bg-[#F3EEFF] text-virgilio-purple ring-1 ring-virgilio-purple/15'
      : 'bg-[#FFF6D6] text-[#5c3a00] ring-1 ring-[#E0A23A]/30 border-l-4 border-l-[#E0A23A]'

  const dismissHover =
    tone === 'lilac'
      ? 'hover:bg-virgilio-purple/10 text-virgilio-purple/70 hover:text-virgilio-purple'
      : 'hover:bg-[#E0A23A]/15 text-[#5c3a00]/70 hover:text-[#5c3a00]'

  return (
    <div
      className={cn(
        'h-9 rounded-xl pl-3 pr-1.5 flex items-center gap-2 shadow-sm',
        styles,
        className,
      )}
    >
      {children}
      {onDismiss && (
        <IconTip label="Dismiss">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            'ml-1 h-6 w-6 rounded-md inline-flex items-center justify-center shrink-0 transition-colors',
            dismissHover,
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
        </IconTip>
      )}
    </div>
  )
}
