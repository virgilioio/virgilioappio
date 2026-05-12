import { Link, useLocation } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import gilioIcon from '@/assets/gilio-icon.png'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type AppSection = 'home' | 'ats' | null

const ATS_PREFIXES = ['/find', '/jobs', '/candidates', '/pipeline', '/analytics', '/talent-intelligence']

export function getActiveSection(pathname: string): AppSection {
  if (pathname === '/' || pathname === '/dashboard') return 'home'
  if (ATS_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return 'ats'
  return null
}

type IconRenderer = (props: { className?: string }) => JSX.Element

const GilioIcon: IconRenderer = ({ className }) => (
  <span
    aria-hidden
    className={cn('inline-block bg-current', className)}
    style={{
      WebkitMaskImage: `url(${gilioIcon})`,
      maskImage: `url(${gilioIcon})`,
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
    }}
  />
)

const BriefcaseIcon: IconRenderer = ({ className }) => <Briefcase className={className} strokeWidth={1.75} />

const items: Array<{ id: Exclude<AppSection, null>; label: string; Icon: IconRenderer; href: string }> = [
  { id: 'home', label: 'Home', Icon: GilioIcon, href: '/dashboard' },
  { id: 'ats', label: 'ATS', Icon: BriefcaseIcon, href: '/jobs' },
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
                  <Icon className="h-6 w-6" />
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
