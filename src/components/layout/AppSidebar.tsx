import { Link, useLocation } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import gilioIcon from '@/assets/gilio-icon.png'

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

const BriefcaseIcon: IconRenderer = ({ className }) => <Briefcase className={className} />

const items: Array<{ id: Exclude<AppSection, null>; label: string; Icon: IconRenderer; href: string }> = [
  { id: 'home', label: 'Home', Icon: GilioIcon, href: '/dashboard' },
  { id: 'ats', label: 'ATS', Icon: BriefcaseIcon, href: '/jobs' },
]

export function AppSidebar() {
  const { pathname } = useLocation()
  const active = getActiveSection(pathname)

  return (
    <aside
      className="hidden sm:flex fixed top-3 left-3 bottom-3 z-[60] w-16 flex-col items-center gap-2 rounded-2xl bg-surface-primary py-4 shadow-calendly ring-1 ring-virgilio-border/60"
      aria-label="Primary"
    >
      {items.map(item => {
        const { Icon } = item
        const isActive = active === item.id
        return (
          <Link
            key={item.id}
            to={item.href}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            className={cn(
              'group flex w-12 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-2 text-[10px] font-poppins font-medium tracking-tight transition-all duration-200 ease-out',
              isActive
                ? 'bg-virgilio-purple text-white font-semibold'
                : 'text-virgilio-text hover:bg-virgilio-purple/10'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </aside>
  )
}
