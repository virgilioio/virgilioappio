import { Link, useLocation } from 'react-router-dom'
import { Settings as SettingsIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'

export type AppSection = 'home' | 'ats' | 'crm' | 'analytics' | 'settings' | 'my-profile' | null

const ATS_PREFIXES = ['/find', '/jobs', '/candidates', '/pipeline', '/calendar']
const CRM_PREFIXES = ['/crm']
const ANALYTICS_PREFIXES = ['/analytics', '/talent-intelligence', '/insights']

export function getActiveSection(pathname: string, search = ''): AppSection {
  if (pathname === '/' || pathname === '/dashboard') return 'home'
  if (ANALYTICS_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'analytics'
  if (CRM_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'crm'
  if (ATS_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'ats'
  if (pathname === '/settings' || pathname === '/billing') {
    const params = new URLSearchParams(search)
    return params.get('tab') === 'profile' ? 'my-profile' : 'settings'
  }
  return null
}

type IconRenderer = (props: { className?: string }) => JSX.Element

/**
 * Dashboard glyph — exact 48×48 geometry. The lilac "signal" dot uses the
 * `.accent` class so the tile controls its fill (lilac only on hover/active).
 */
const DashboardGlyph: IconRenderer = ({ className }) => (
  <svg viewBox="0 0 48 48" aria-hidden className={cn('inline-block', className)}>
    <circle className="accent" cx="13.5" cy="13.5" r="4.5" fill="currentColor" />
    <rect x="22" y="9" width="17" height="9" rx="4.5" fill="currentColor" />
    <rect x="9" y="21.5" width="30" height="9" rx="4.5" fill="currentColor" />
    <rect x="9" y="34" width="21" height="9" rx="4.5" fill="currentColor" />
  </svg>
)

/**
 * Brand module glyphs — exact 48×48 geometry from spec.
 * Main shapes use `currentColor` so the tile controls their color via `text-*`.
 * Accent shape carries the `accent` class so the tile can override its fill
 * (`[&_.accent]:fill-[#D7C5FB]`) on hover/active. At rest on an inactive tile
 * the accent inherits `currentColor` — i.e., signal OFF, no lilac.
 */
const AtsGlyph: IconRenderer = ({ className }) => (
  <svg viewBox="0 0 48 48" aria-hidden className={cn('inline-block', className)}>
    <circle cx="24" cy="19.4" r="9.9" fill="currentColor" />
    <rect className="accent" x="20.7" y="29.9" width="13.2" height="8.8" rx="4.4" fill="currentColor" />
  </svg>
)

const CrmGlyph: IconRenderer = ({ className }) => (
  <svg viewBox="0 0 48 48" aria-hidden className={cn('inline-block', className)}>
    <rect x="8.5" y="14.5" width="22" height="9" rx="4.5" fill="currentColor" />
    <rect className="accent" x="17.5" y="26.5" width="22" height="9" rx="4.5" fill="currentColor" />
  </svg>
)

const AnalyticsGlyph: IconRenderer = ({ className }) => (
  <svg viewBox="0 0 48 48" aria-hidden className={cn('inline-block', className)}>
    <rect x="9" y="25" width="9" height="14" rx="4.5" fill="currentColor" />
    <rect x="19.5" y="19" width="9" height="20" rx="4.5" fill="currentColor" />
    <rect x="30" y="18" width="9" height="21" rx="4.5" fill="currentColor" />
    <circle className="accent" cx="34.5" cy="10" r="4.5" fill="currentColor" />
  </svg>
)

const allItems: Array<{ id: Exclude<AppSection, null | 'my-profile' | 'settings'>; label: string; Icon: IconRenderer; href: string; show: (p: ReturnType<typeof usePermissions>) => boolean }> = [
  { id: 'home', label: 'Dashboard', Icon: DashboardGlyph, href: '/dashboard', show: (p) => !p.isSalesUser },
  { id: 'ats', label: 'ATS', Icon: AtsGlyph, href: '/jobs', show: (p) => p.canViewJobs },
  { id: 'crm', label: 'CRM', Icon: CrmGlyph, href: '/crm', show: (p) => p.canViewOrganizations },
  { id: 'analytics', label: 'Analytics', Icon: AnalyticsGlyph, href: '/analytics', show: (p) => !p.isSalesUser },
]

// Tile classes — state-aware. The accent shape inside the glyph receives lilac
// fill only on hover/active; inactive keeps it at currentColor (signal OFF).
const tileBase =
  'flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ease-out'
const tileActive =
  'bg-[#fffcf9] text-[#0d0d09] [&_.accent]:fill-[#D7C5FB]'
const tileInactive =
  'text-[rgba(255,252,249,0.72)] hover:bg-white/[0.08] hover:text-[#fffcf9] hover:[&_.accent]:fill-[#D7C5FB]'

export function AppSidebar() {
  const { pathname, search } = useLocation()
  const active = getActiveSection(pathname, search)
  const { profile } = useUserProfile()
  const permissions = usePermissions()
  const items = allItems.filter((item) => item.show(permissions))

  const initials = (() => {
    const f = profile?.first_name?.trim()?.[0] ?? ''
    const l = profile?.last_name?.trim()?.[0] ?? ''
    const combined = `${f}${l}`.toUpperCase()
    if (combined) return combined
    return profile?.email?.[0]?.toUpperCase() ?? '?'
  })()

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className="hidden sm:flex fixed top-3 left-3 bottom-3 z-[60] w-16 flex-col items-center py-3"
        style={{
          backgroundColor: '#0d0d09',
          borderRadius: 16,
          boxShadow:
            '0 8px 24px rgba(15,18,34,0.08), inset 0 0 0 1px rgba(255,252,249,0.06)',
          rowGap: 6,
        }}
        aria-label="Primary"
      >
        {items.map(item => {
          const { Icon } = item
          const isActive = active === item.id
          return (
            <div key={item.id} className="flex flex-col items-center" style={{ rowGap: 6 }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.label}
                    title={item.label}
                    className={cn(tileBase, isActive ? tileActive : tileInactive)}
                  >
                    <Icon className="h-6 w-6" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={12}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
              {item.id === 'home' && (
                <div
                  aria-hidden
                  style={{
                    width: 28,
                    height: 1,
                    backgroundColor: 'rgba(255,252,249,0.14)',
                    marginTop: 2,
                    marginBottom: 2,
                  }}
                />
              )}
            </div>
          )
        })}

        {/* Bottom group: Settings cog + user avatar */}
        <div className="mt-auto flex flex-col items-center" style={{ rowGap: 6 }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/settings"
                aria-current={active === 'settings' ? 'page' : undefined}
                aria-label="Settings"
                title="Settings"
                className={cn(tileBase, active === 'settings' ? tileActive : tileInactive)}
              >
                <SettingsIcon className="h-5 w-5" strokeWidth={1.75} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>
              Settings
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/settings?tab=profile"
                aria-current={active === 'my-profile' ? 'page' : undefined}
                aria-label="My Profile"
                title="My Profile"
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ease-out',
                  active === 'my-profile'
                    ? 'ring-2 ring-[#fffcf9] ring-offset-2 ring-offset-[#0d0d09]'
                    : 'hover:ring-2 hover:ring-white/30 hover:ring-offset-2 hover:ring-offset-[#0d0d09]'
                )}
              >
                <Avatar className="h-9 w-9">
                  {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
                  <AvatarFallback className="bg-white/10 text-white text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>
              My Profile
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}
