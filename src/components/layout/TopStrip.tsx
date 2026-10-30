import { ChevronRight, Shield, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { IconTip } from '@/components/ui/tooltip'
import { useAuth } from '@/contexts/AuthContext'
import { useIsMobile } from '@/hooks/use-mobile'
import { motionToken } from '@/lib/motion'
import { missingText, useProfileInvite } from '@/components/os/profileChecks'

/**
 * The top strip (Allan, 2026-10-29, after Deel's): one noir strip across the
 * top of the window, above the rail and the top bar, for the My profile
 * reminder (until your profile is complete) and Platform admin mode (desktop
 * only). With both, the reminder takes the middle and the mode sits at the
 * left edge. The shell moves down to make room (`.gio-has-strip` on <html>,
 * `--gio-strip`, CSS in index.css), so nothing is covered. × hides what's in
 * the middle for the rest of the session.
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
    try {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed))
    } catch {
      /* private mode: the strip just comes back next page load */
    }
  }, [dismissed])

  return {
    isDismissed: (key: string) => !!dismissed[key],
    dismiss: (key: string) => setDismissed((d) => ({ ...d, [key]: true })),
  }
}

interface StripContent {
  kind: 'profile' | 'admin'
  withMode: boolean
  done: number
  total: number
  missing: string
  to: string
}

export function TopStrip() {
  const { userType } = useAuth()
  const isPhone = useIsMobile()
  const { isDismissed, dismiss } = useDismissed()
  const invite = useProfileInvite()

  const admin = userType === 'platform_admin' && !isPhone && !isDismissed('admin')
  const first = invite.missing[0]
  const profile = invite.showBand && !!first && !isDismissed('profile')

  const want: StripContent | null = profile
    ? { kind: 'profile', withMode: admin, done: invite.done, total: invite.total, missing: missingText(invite.missing.map((c) => c.inline)), to: first.to }
    : admin
      ? { kind: 'admin', withMode: false, done: 0, total: 0, missing: '', to: '' }
      : null

  // What's on screen: kept through the closing fade, so the strip leaves with its text.
  const [shown, setShown] = useState<StripContent | null>(want)
  const [phase, setPhase] = useState<'open' | 'opening' | 'closing'>('opening')
  const closeTimer = useRef<number>()

  const wantKey = want ? JSON.stringify(want) : ''
  useEffect(() => {
    window.clearTimeout(closeTimer.current)
    if (want) {
      setShown(want)
      setPhase((p) => (p === 'open' ? 'open' : 'opening'))
      return
    }
    if (!shown) return
    setPhase('closing')
    closeTimer.current = window.setTimeout(() => setShown(null), motionToken('--dur-dialog-out', 150))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- wantKey stands for want
  }, [wantKey])

  // Fade in a frame after mounting, so the opacity transition has a start.
  useEffect(() => {
    if (phase !== 'opening') return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('open')))
    return () => cancelAnimationFrame(id)
  }, [phase])

  // The shell makes room while the strip is wanted; it follows the strip only
  // after the first paint, never on page load.
  const open = !!want
  useLayoutEffect(() => {
    const html = document.documentElement
    html.classList.toggle('gio-has-strip', open)
    html.classList.toggle('gio-strip-closing', !open)
  }, [open])
  useEffect(() => {
    const html = document.documentElement
    const id = requestAnimationFrame(() => requestAnimationFrame(() => html.classList.add('gio-strip-anim')))
    return () => {
      cancelAnimationFrame(id)
      html.classList.remove('gio-has-strip', 'gio-strip-anim', 'gio-strip-closing')
    }
  }, [])

  if (!shown) return null
  const onDismiss = () => dismiss(shown.kind)

  return (
    <div className="gio-strip" data-state={phase} role="region" aria-label={shown.kind === 'profile' ? 'Your profile' : 'Platform admin'}>
      <div className="relative flex h-10 items-center justify-center gap-3 pl-3 pr-12 sm:px-14 lg:px-48">
        {shown.withMode && (
          <span className="gio-strip-mode absolute left-4 top-1/2 -translate-y-1/2 hidden lg:inline-flex">
            <Shield className="h-3 w-3" aria-hidden />
            Platform admin
          </span>
        )}
        {shown.kind === 'profile' ? (
          <>
            <span className="gio-strip-tag">
              My profile<span className="hidden sm:inline tabular-nums"> · {shown.done} of {shown.total}</span>
            </span>
            <span className="min-w-0 truncate text-[13px] font-medium text-[#FFFCF9]/90">
              <span className="sm:hidden tabular-nums">{shown.done} of {shown.total} done</span>
              <span className="hidden sm:inline">Add your {shown.missing} to finish your profile.</span>
            </span>
            <Link to={shown.to} className="gio-strip-cta shrink-0">
              Finish profile
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </>
        ) : (
          <>
            <span className="gio-strip-tag">
              <Shield className="h-3 w-3" aria-hidden />
              Platform admin
            </span>
            <span className="min-w-0 truncate text-[13px] font-medium text-[#FFFCF9]/90">
              You're viewing data across all organizations.
            </span>
          </>
        )}
        <IconTip label="Hide for now">
          <button type="button" onClick={onDismiss} aria-label="Hide for now" className="gio-strip-x absolute right-2 top-1/2 -translate-y-1/2 sm:right-3">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </IconTip>
      </div>
    </div>
  )
}
