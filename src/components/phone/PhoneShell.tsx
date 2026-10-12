import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut, Search } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { IconTip } from '@/components/ui/tooltip'
import { SearchResultsDialog } from '@/components/search/SearchResultsDialog'
import { AtsGlyph, CalendarGlyph, CandidatesGlyph, DashboardGlyph, JobsGlyph, type ModuleGlyph } from '@/components/icons/ModuleGlyphs'
import { SettingsGlyph } from '@/components/icons/SettingsGlyph'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { BookingLinkCard } from './BookingLinkCard'

/**
 * The phone shell (2026-10-12), in Gio Docs' phone frame so the two products
 * feel like one family:
 * - Section screens open with a row of round tabs at the top: you (account,
 *   booking link, settings), then pills for the module's sections — the
 *   current one names itself, the others show only their icon. Switching
 *   slides the pills (clip-path + transform, --dur-tabs / --ease-in-out).
 * - A record (a job, a candidate) runs under a floating round Back button.
 * - At the bottom floats a bar: the module glyphs from the desktop rail
 *   (Dashboard, ATS) as round buttons, then a wide Search pill.
 * Analytics, Intelligence and chat stay on the computer.
 */

type Perm = ReturnType<typeof usePermissions>
type ModuleId = 'home' | 'ats'

interface Section { id: string; href: string; label: string; Icon: ModuleGlyph; match: (p: string) => boolean; show: (perm: Perm) => boolean }

const SECTIONS: Record<ModuleId, Section[]> = {
  home: [
    { id: 'today', href: '/dashboard', label: 'Today', Icon: DashboardGlyph, match: p => p === '/' || p === '/dashboard', show: () => true },
  ],
  ats: [
    { id: 'jobs', href: '/jobs', label: 'Jobs', Icon: JobsGlyph, match: p => p === '/jobs', show: perm => perm.canViewJobs },
    { id: 'candidates', href: '/candidates', label: 'Candidates', Icon: CandidatesGlyph, match: p => p === '/candidates', show: perm => perm.canViewCandidates },
    { id: 'calendar', href: '/calendar', label: 'Calendar', Icon: CalendarGlyph, match: p => p === '/calendar', show: () => true },
  ],
}

const MODULES: { id: ModuleId; label: string; Glyph: ModuleGlyph }[] = [
  { id: 'home', label: 'Dashboard', Glyph: DashboardGlyph },
  { id: 'ats', label: 'ATS', Glyph: AtsGlyph },
]

const ATS_PREFIXES = ['/jobs', '/candidates', '/calendar', '/pipeline', '/find']

function moduleOf(pathname: string): ModuleId | null {
  if (pathname === '/' || pathname === '/dashboard') return 'home'
  if (ATS_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'ats'
  return null
}

function useMe() {
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const name = (profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.first_name) || user?.email?.split('@')[0] || 'You'
  const initials = profile?.first_name && profile?.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?'
  return { name, initials, email: user?.email ?? '', avatar: profile?.avatar_url ?? undefined }
}

export function PhoneShell() {
  const { pathname, key } = useLocation()
  const navigate = useNavigate()
  const perm = usePermissions()
  const me = useMe()
  const [searchOpen, setSearchOpen] = useState(false)
  const [youOpen, setYouOpen] = useState(false)

  const mod = moduleOf(pathname)
  const sections = mod ? SECTIONS[mod].filter(s => s.show(perm)) : []
  const current = sections.find(s => s.match(pathname))
  const modules = MODULES.filter(m => SECTIONS[m.id].some(s => s.show(perm)))
  const back = () => {
    // Opened straight from a link (no history inside the app): go to the module.
    if (key === 'default') navigate(mod === 'ats' ? (pathname.startsWith('/candidates') ? '/candidates' : '/jobs') : '/dashboard')
    else navigate(-1)
  }

  return (
    <>
      {current ? (
        <PhoneTopTabs sections={sections} current={current.id} me={me} onAccount={() => setYouOpen(true)} />
      ) : (
        <div className="gio-phone-top sm:hidden pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center">
          <Circle label="Back" onClick={back} size={48}>
            <ArrowLeft className="h-[22px] w-[22px]" strokeWidth={2} />
          </Circle>
        </div>
      )}

      <div className="gio-phone-bottom sm:hidden pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-center">
        <nav aria-label="Modules" className="flex items-center gap-3">
          {modules.map(({ id, label, Glyph }) => {
            const active = mod === id
            const href = SECTIONS[id].find(s => s.show(perm))!.href
            return (
              <IconTip key={id} label={label}>
                <Link
                  to={href}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'gio-pressable gio-phone-float pointer-events-auto grid h-14 w-14 shrink-0 place-items-center rounded-full transition-colors duration-150',
                    active ? 'gio-phone-float-active text-[#fffcf9] [&_.accent]:fill-[#D7C5FB]' : 'text-[#0d0d09]',
                  )}
                >
                  <Glyph className="h-[34px] w-[34px]" />
                </Link>
              </IconTip>
            )
          })}
        </nav>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          className="gio-pressable gio-phone-float pointer-events-auto flex h-14 min-w-0 flex-1 items-center gap-2.5 rounded-full px-5 font-inter text-[16px] text-[#5A6072]"
        >
          <Search className="h-[21px] w-[21px] shrink-0" strokeWidth={2} />
          <span className="truncate">Search</span>
        </button>
      </div>

      <SearchResultsDialog open={searchOpen} onOpenChange={setSearchOpen} initialQuery="" />
      <YouSheet open={youOpen} onOpenChange={setYouOpen} me={me} />
    </>
  )
}

function Circle({ label, onClick, size = 56, children }: { label: string; onClick: () => void; size?: number; children: ReactNode }) {
  return (
    <IconTip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="gio-pressable gio-phone-float pointer-events-auto grid shrink-0 place-items-center rounded-full text-[#0d0d09]"
        style={{ width: size, height: size }}
      >
        {children}
      </button>
    </IconTip>
  )
}

/* ────────────── Top tabs (Gio Docs' PhoneTopTabs) ────────────── */

type TabRects = Record<string, { left: number; right: number; icon: number }>
const FILL_REACH = 400 // how far a pill's fill reaches past its tab (clipped)
const restClip = `inset(0 ${FILL_REACH}px 0 ${FILL_REACH}px round 26px)`

function toMs(v: string): number | null {
  const n = parseFloat(v)
  if (!Number.isFinite(n)) return null
  return /ms\s*$/.test(v) ? n : n * 1000
}

function readTabRects(nav: HTMLElement): TabRects {
  const out: TabRects = {}
  nav.querySelectorAll<HTMLElement>('[data-tab]').forEach(el => {
    const r = el.getBoundingClientRect()
    const icon = el.querySelector<HTMLElement>('[data-tab-icon]')?.getBoundingClientRect()
    out[el.dataset.tab!] = { left: r.left, right: r.right, icon: icon ? icon.left : r.left }
  })
  return out
}

/** The pills slide to their new sizes: each fill's edges move from where they
 *  were (clip-path), the icon glides (transform), the picked tab's name fades
 *  in. Nothing animates layout; reduced motion keeps only the colours. */
function slideTabs(nav: HTMLElement, from: TabRects) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const css = getComputedStyle(document.documentElement)
  const duration = toMs(css.getPropertyValue('--dur-tabs')) ?? 260
  const easing = css.getPropertyValue('--ease-in-out').trim() || 'ease-in-out'
  const to = readTabRects(nav)
  nav.querySelectorAll<HTMLElement>('[data-tab]').forEach(el => {
    const id = el.dataset.tab!
    const a = from[id]
    const b = to[id]
    if (!a || !b) return
    const fill = el.querySelector<HTMLElement>('[data-tab-fill]')
    const icon = el.querySelector<HTMLElement>('[data-tab-icon]')
    const label = el.querySelector<HTMLElement>('[data-tab-label]')
    const stop = (x: Animation) => (typeof CSSTransition !== 'undefined' && x instanceof CSSTransition ? null : x.cancel())
    fill?.getAnimations().forEach(stop)
    icon?.getAnimations().forEach(stop)
    const l = FILL_REACH + (a.left - b.left)
    const r = FILL_REACH + (b.right - a.right)
    fill?.animate([{ clipPath: `inset(0 ${r}px 0 ${l}px round 26px)` }, { clipPath: restClip }], { duration, easing })
    const dx = a.icon - b.icon
    if (dx) icon?.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration, easing })
    label?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration, easing: 'linear' })
  })
}

function PhoneTopTabs({ sections, current, me, onAccount }: {
  sections: Section[]
  current: string
  me: ReturnType<typeof useMe>
  onAccount: () => void
}) {
  const navRef = useRef<HTMLElement | null>(null)
  const before = useRef<TabRects | null>(null)
  const ids = sections.map(s => s.id).join(',')
  const capture = () => { if (navRef.current) before.current = readTabRects(navRef.current) }
  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return
    // Only slide between tabs of the same row (a module switch just appears).
    if (before.current && Object.keys(before.current).join(',') === ids) slideTabs(nav, before.current)
    before.current = readTabRects(nav)
  }, [current, ids])

  return (
    <nav
      ref={navRef}
      aria-label="Sections"
      className="gio-phone-tabs sm:hidden fixed inset-x-0 top-0 z-50 flex items-center bg-[#F6F5F1]"
      onPointerDownCapture={capture}
      onClickCapture={capture}
    >
      <IconTip label="You, your booking link and settings">
        <button
          type="button"
          onClick={onAccount}
          aria-label="You, your booking link and settings"
          className="gio-pressable gio-phone-circle grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-white"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={me.avatar} alt="" />
            <AvatarFallback className="bg-[#0d0d09] font-poppins font-semibold text-[13px] text-[#fffcf9]">{me.initials}</AvatarFallback>
          </Avatar>
        </button>
      </IconTip>
      {sections.map(({ id, href, label, Icon }) => {
        const active = id === current
        return (
          <Link
            key={id}
            to={href}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            data-tab={id}
            className={cn(
              'gio-pressable gio-phone-tab relative flex h-[52px] min-w-0 items-center justify-center gap-2',
              active ? 'text-[#0d0d09] [&_.accent]:fill-[#D7C5FB]' : 'text-[#5A6072]',
            )}
            style={{ flex: active ? '2 1 0' : '1 1 0' }}
          >
            <span aria-hidden data-tab-fill className={cn('gio-phone-tab-fill', active ? 'bg-[#E5E3DA]' : 'bg-[#ECEAE3]')} />
            <span data-tab-icon className="relative grid shrink-0 place-items-center">
              <Icon className="h-[28px] w-[28px]" />
            </span>
            {active && (
              <span data-tab-label className="relative truncate font-poppins font-semibold text-[17px] tracking-[-0.01em]">{label}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function YouSheet({ open, onOpenChange, me }: { open: boolean; onOpenChange: (o: boolean) => void; me: ReturnType<typeof useMe> }) {
  const { logout, isLoggingOut } = useAuth()
  const navigate = useNavigate()
  const go = (to: string) => { onOpenChange(false); navigate(to) }
  const signOut = async () => {
    await logout()
    setTimeout(() => navigate('/auth', { replace: true }), 100)
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[20px] border-0 bg-[#F6F5F1] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-3">
        <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D9D6CE]" />
        <div className="mb-4 flex items-center gap-3">
          <Avatar className="h-11 w-11">
            <AvatarImage src={me.avatar} alt="" />
            <AvatarFallback className="bg-[#0d0d09] text-[14px] font-poppins font-semibold text-[#fffcf9]">{me.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <SheetTitle className="truncate font-poppins font-semibold text-[16px] text-[#0d0d09]">{me.name}</SheetTitle>
            <SheetDescription className="truncate font-inter text-[12.5px] text-[#5A6072]">{me.email}</SheetDescription>
          </div>
        </div>

        <BookingLinkCard dark />

        <div className="mt-3 overflow-hidden rounded-[14px] border border-[#E7E8EE] bg-white">
          <button type="button" onClick={() => go('/settings')} className="gio-pressable flex w-full items-center gap-3 border-b border-[#F1F0EC] px-4 py-3.5 text-left font-inter font-medium text-[14px] text-[#0d0d09]">
            <span aria-hidden className="inline-flex"><SettingsGlyph size={18} color="#5A6072" accent="#5A6072" /></span>
            Settings
          </button>
          <button type="button" onClick={signOut} disabled={isLoggingOut} className="gio-pressable flex w-full items-center gap-3 px-4 py-3.5 text-left font-inter font-medium text-[14px] text-[#B91C1C] disabled:opacity-60">
            <LogOut className="h-[18px] w-[18px]" />
            {isLoggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
