import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions, useCanUseChat } from '@/hooks/usePermissions'
import { useTalentPoolAccess } from '@/hooks/useTalentPoolAccess'
import { useChatUnreadCount } from '@/hooks/chat/useChatUnreadCount'
import { AnalyticsGlyph, AtsGlyph, ChatGlyph, DashboardGlyph, PeopleGlyph, ReferencesModuleGlyph, type ModuleGlyph } from '@/components/icons/ModuleGlyphs'
import { SettingsGlyph } from '@/components/icons/SettingsGlyph'


export type AppSection = 'home' | 'ats' | 'crm' | 'chat' | 'references' | 'analytics' | 'people' | 'settings' | 'my-profile' | null

const ATS_PREFIXES = ['/find', '/jobs', '/candidates', '/pipeline', '/calendar']
const CRM_PREFIXES = ['/crm']
const CHAT_PREFIXES = ['/chat']
const REFERENCES_PREFIXES = ['/references']
const ANALYTICS_PREFIXES = ['/analytics', '/talent-intelligence', '/insights']
const PEOPLE_PREFIXES = ['/os']

export function getActiveSection(pathname: string, search = ''): AppSection {
  if (pathname === '/' || pathname === '/dashboard') return 'home'
  if (ANALYTICS_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'analytics'
  if (PEOPLE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'people'
  if (REFERENCES_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'references'
  if (CHAT_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'chat'
  if (CRM_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'crm'
  if (ATS_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'ats'
  if (pathname === '/settings' || pathname === '/billing') {
    const params = new URLSearchParams(search)
    return params.get('tab') === 'profile' ? 'my-profile' : 'settings'
  }
  return null
}

type IconRenderer = ModuleGlyph
const ReferencesGlyph = ReferencesModuleGlyph

const allItems: Array<{ id: Exclude<AppSection, null | 'my-profile' | 'settings'>; label: string; Icon: IconRenderer; href: string; show: (p: ReturnType<typeof usePermissions>) => boolean }> = [
  { id: 'home', label: 'Dashboard', Icon: DashboardGlyph, href: '/dashboard', show: (p) => !p.isSalesUser },
  { id: 'ats', label: 'ATS', Icon: AtsGlyph, href: '/jobs', show: (p) => p.canViewJobs },
  { id: 'chat', label: 'Chat', Icon: ChatGlyph, href: '/chat', show: () => false }, // gated via useCanUseChat below
  { id: 'references', label: 'Reference checks', Icon: ReferencesGlyph, href: '/references', show: (p) => p.canViewReferences },
  { id: 'analytics', label: 'Analytics', Icon: AnalyticsGlyph, href: '/analytics', show: (p) => !p.isSalesUser },
]

// Tile classes — state-aware. The accent shape inside the glyph receives lilac
// fill only on hover/active; inactive keeps it at currentColor (signal OFF).
const tileBase =
  'flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-[var(--dur-hover)]'
const tileActive =
  'bg-[#fffcf9] text-[#0d0d09] [&_.accent]:fill-[#D7C5FB]'
const tileInactive =
  // gio-rail-tile: the signal turns lilac on hover (rule in index.css, mouse only).
  'gio-rail-tile text-[rgba(255,252,249,0.72)] hover:bg-white/[0.08] hover:text-[#fffcf9]'

export function AppSidebar() {
  const { pathname, search } = useLocation()
  const active = getActiveSection(pathname, search)
  const { profile } = useUserProfile()
  const permissions = usePermissions()
  const canUseChat = useCanUseChat()
  const talentPool = useTalentPoolAccess() !== false
  const items = allItems
    .filter((item) => (item.id === 'chat' ? canUseChat : item.show(permissions)))
    // Job-based access: references and analytics work on the talent pool.
    .filter((item) => talentPool || (item.id !== 'references' && item.id !== 'analytics'))
  const { data: chatUnread = 0 } = useChatUnreadCount()

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
                    aria-label={item.id === 'chat' && chatUnread > 0 ? `${item.label} (${chatUnread} unread)` : item.label}
                    className={cn(tileBase, isActive ? tileActive : tileInactive, 'relative')}
                  >
                    <Icon className="h-6 w-6" />
                    {item.id === 'chat' && chatUnread > 0 && (
                      <span
                        aria-hidden
                        className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#D7C5FB] text-[#0d0d09] font-poppins font-semibold text-[10px] leading-none flex items-center justify-center ring-2 ring-[#0d0d09]"
                      >
                        {chatUnread > 99 ? '99+' : chatUnread}
                      </span>
                    )}
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

        {/* Workspace tools: People & Access sits apart from the hiring modules, after a divider. */}
        {(permissions.isPlatformAdmin || permissions.isAdmin) && (
          <>
            <div
              aria-hidden
              style={{ width: 28, height: 1, backgroundColor: 'rgba(255,252,249,0.14)', marginTop: 2, marginBottom: 2 }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/os/people"
                  aria-current={active === 'people' ? 'page' : undefined}
                  aria-label="People & Access"
                  className={cn(tileBase, active === 'people' ? tileActive : tileInactive)}
                >
                  <PeopleGlyph className="h-6 w-6" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12}>
                People &amp; Access
              </TooltipContent>
            </Tooltip>
          </>
        )}

        {/* Bottom group: Settings + user avatar */}
        <div className="mt-auto flex flex-col items-center" style={{ rowGap: 6 }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/settings"
                aria-current={active === 'settings' ? 'page' : undefined}
                aria-label="Settings"
                className={cn(tileBase, active === 'settings' ? tileActive : tileInactive, 'group')}
              >
                {active === 'settings' ? (
                  <SettingsGlyph size={20} color="#0d0d09" accent="#D7C5FB" />
                ) : (
                  <span className="relative h-5 w-5" aria-hidden>
                    <span className="absolute inset-0 transition-opacity group-hover:opacity-0">
                      <SettingsGlyph size={20} color="rgba(255,252,249,0.72)" accent="rgba(255,252,249,0.72)" />
                    </span>
                    <span className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                      <SettingsGlyph size={20} color="#fffcf9" accent="#fffcf9" />
                    </span>
                  </span>
                )}
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
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full transition-shadow duration-hover',
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
