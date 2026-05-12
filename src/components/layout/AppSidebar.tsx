import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import gilioIcon from '@/assets/gio-home-icon.png'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUserProfile } from '@/hooks/useUserProfile'

export type AppSection = 'home' | 'ats' | 'settings' | 'my-profile' | null

const ATS_PREFIXES = ['/find', '/jobs', '/candidates', '/pipeline', '/analytics', '/talent-intelligence']

export function getActiveSection(pathname: string, search = ''): AppSection {
  if (pathname === '/' || pathname === '/dashboard') return 'home'
  if (ATS_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'ats'
  if (pathname === '/settings' || pathname === '/billing') {
    const params = new URLSearchParams(search)
    return params.get('tab') === 'profile' ? 'my-profile' : 'settings'
  }
  return null
}

type IconRenderer = (props: { className?: string }) => JSX.Element

const GilioIcon: IconRenderer = ({ className }) => (
  <img
    src={gilioIcon}
    alt=""
    aria-hidden
    className={cn('inline-block object-contain', className)}
  />
)

// Inline SVG using currentColor — recolor on active/inactive is instant,
// no asset swap, no flash. Industry standard for chrome icons.
const AtsIcon: IconRenderer = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
    className={cn('inline-block', className)}
  >
    <circle cx="10" cy="8.5" r="6.5" />
    <rect x="8" y="17" width="9" height="5" rx="2.5" />
  </svg>
)

const CogIcon: IconRenderer = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={cn('inline-block', className)}
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const items: Array<{ id: Exclude<AppSection, null | 'my-profile'>; label: string; Icon: IconRenderer; href: string }> = [
  { id: 'home', label: 'Home', Icon: GilioIcon, href: '/dashboard' },
  { id: 'ats', label: 'ATS', Icon: AtsIcon, href: '/jobs' },
]

export function AppSidebar() {
  const { pathname, search } = useLocation()
  const active = getActiveSection(pathname, search)
  const { profile } = useUserProfile()

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
        className="hidden sm:flex fixed top-3 left-3 bottom-3 z-[60] w-16 flex-col items-center gap-2 rounded-2xl py-4 shadow-calendly ring-1 ring-black/40"
        style={{ backgroundColor: '#0d0d09' }}
        aria-label="Primary"
      >
        {items.map(item => {
          const { Icon } = item
          const isActive = active === item.id
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Link
                  to={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ease-out',
                    isActive
                      ? 'bg-[#fffcf9] text-black'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon className="h-6 w-6" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          )
        })}

        {/* Bottom group: Settings cog + user avatar */}
        <div className="mt-auto flex flex-col items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/settings"
                aria-current={active === 'settings' ? 'page' : undefined}
                aria-label="Settings"
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ease-out',
                  active === 'settings'
                    ? 'bg-[#fffcf9] text-black'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                <CogIcon className="h-5 w-5" />
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
                  'flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 ease-out',
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
