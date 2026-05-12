import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import gilioIcon from '@/assets/gio-home-icon.png'
import atsIconBlack from '@/assets/ats-icon-black.png'
import atsIconWhite from '@/assets/ats-icon-white.png'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type AppSection = 'home' | 'ats' | null

const ATS_PREFIXES = ['/find', '/jobs', '/candidates', '/pipeline', '/analytics', '/talent-intelligence']

export function getActiveSection(pathname: string): AppSection {
  if (pathname === '/' || pathname === '/dashboard') return 'home'
  if (ATS_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'ats'
  return null
}

type IconRenderer = (props: { className?: string; isActive?: boolean }) => JSX.Element

const GilioIcon: IconRenderer = ({ className }) => (
  <img
    src={gilioIcon}
    alt=""
    aria-hidden
    className={cn('inline-block object-contain', className)}
  />
)

const AtsIcon: IconRenderer = ({ className, isActive }) => (
  <img
    src={isActive ? atsIconBlack : atsIconWhite}
    alt=""
    aria-hidden
    className={cn('inline-block object-contain', className)}
  />
)

const items: Array<{ id: Exclude<AppSection, null>; label: string; Icon: IconRenderer; href: string }> = [
  { id: 'home', label: 'Home', Icon: GilioIcon, href: '/dashboard' },
  { id: 'ats', label: 'ATS', Icon: AtsIcon, href: '/jobs' },
]

export function AppSidebar() {
  const { pathname } = useLocation()
  const active = getActiveSection(pathname)

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
                  <Icon className="h-6 w-6" isActive={isActive} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </aside>
    </TooltipProvider>
  )
}
