import { ReactNode, useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Home,
  Briefcase,
  Building2,
  Settings,
  LogOut,
  Users,
  TrendingUp,
  Sparkles,
  BarChart3,
  Lightbulb,
  Handshake,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { GlobalCreateButton } from '@/components/layout/GlobalCreateButton'
import { SourcingCreditIndicator } from '@/components/layout/SourcingCreditIndicator'
import { GlobalSearchBar } from '@/components/search/GlobalSearchBar'
import { NotificationCenter } from '@/components/layout/NotificationCenter'
import { getActiveSection, type AppSection } from '@/components/layout/AppSidebar'

import { cn } from '@/lib/utils'
import { useMembers } from '@/hooks/useMembers'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabaseClient'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useUserJobRoles } from '@/hooks/useUserJobRoles'

type NavItem = {
  href: string
  icon: typeof Home
  label: string
  show: boolean
  section: Exclude<AppSection, null>
  notification?: boolean
  dropdown?: () => ReactNode
}

export function Header() {
  const { user, logout, organizationId, isLoggingOut } = useAuth()
  const {
    canViewJobs,
    canViewOrganizations,
    canViewCandidatesNavigation,
    isPlatformAdmin,
    isWorkspaceOwner,
    isAdmin,
    isMember,
  } = usePermissions()
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const { members } = useMembers()
  const { toast } = useToast()
  const { profile } = useUserProfile()
  const { hasRecruiterRole, isPrivileged } = useUserJobRoles()

  const canSeeRecruiterTools = isPrivileged || hasRecruiterRole

  const handleLogout = async () => {
    await logout()
    setTimeout(() => navigate('/auth', { replace: true }), 100)
  }

  // Scroll shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 2)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Workspace switcher data
  const myOrgMemberships = (members || []).filter(
    (m) => m.user_id === user?.id && m.user_status === 'active',
  )
  const uniqueOrgs = Array.from(
    new Map(
      myOrgMemberships.map((m) => [
        m.organization_id,
        { id: m.organization_id, name: m.organization_name || m.organization_id.slice(0, 8) },
      ]),
    ).values(),
  )
  const currentOrgName =
    uniqueOrgs.find((o) => o.id === organizationId)?.name || 'Select workspace'

  const switchWorkspace = async (orgId: string) => {
    try {
      const switchPromise = supabase.functions.invoke('set-current-organization', {
        body: { organizationId: orgId },
      })
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Switch timeout')), 8000),
      )
      const { error } = (await Promise.race([switchPromise, timeout])) as any
      if (error) throw error
      await supabase.auth.refreshSession()
      toast({ title: 'Workspace switched', description: 'Reloading your data...' })
      window.location.reload()
    } catch (e) {
      console.error('[Workspace Switch] Failed:', e)
      toast({
        title: 'Failed to switch',
        description: 'Please try again or contact support.',
        variant: 'destructive',
      })
    }
  }

  const navigationItems: NavItem[] = [
    {
      href: '/find',
      icon: Sparkles,
      label: 'Find',
      show:
        canSeeRecruiterTools &&
        (isPlatformAdmin || isWorkspaceOwner || isAdmin || isMember),
      section: 'ats',
    },
    { href: '/jobs', icon: Briefcase, label: 'Jobs', show: canViewJobs, section: 'ats' },
    {
      href: '/candidates',
      icon: Users,
      label: 'Candidates',
      show: canSeeRecruiterTools && canViewCandidatesNavigation,
      section: 'ats',
    },
    { href: '/pipeline', icon: TrendingUp, label: 'Pipeline', show: canViewJobs, section: 'ats' },
    {
      href: '/analytics',
      icon: BarChart3,
      label: 'Analytics',
      show: isPlatformAdmin || isWorkspaceOwner || isAdmin,
      section: 'ats',
    },
    {
      href: '/talent-intelligence',
      icon: Lightbulb,
      label: 'Intelligence',
      show: isPlatformAdmin || isWorkspaceOwner || isAdmin,
      section: 'ats',
    },
    {
      href: '/crm',
      icon: Building2,
      label: 'Companies',
      show: canViewOrganizations,
      section: 'crm',
    },
    {
      href: '/crm/deals',
      icon: Handshake,
      label: 'Deals',
      show: canViewOrganizations,
      section: 'crm',
    },
  ]

  const activeSection = getActiveSection(location.pathname)
  const visibleNavItems = navigationItems.filter(
    (item) => item.show && item.section === activeSection,
  )

  const userDisplayName =
    (profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : profile?.first_name) ||
    user?.email?.split('@')[0] ||
    'User'
  const userInitials =
    profile?.first_name && profile?.last_name
      ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
      : user?.email?.[0]?.toUpperCase() || 'U'

  return (
    <header
      className={cn(
        'hidden sm:flex fixed top-3 right-3 left-[5.5rem] z-50 h-11 items-center rounded-2xl ring-1 ring-white/[0.06] transition-shadow',
        scrolled
          ? 'shadow-[0_6px_24px_-12px_rgba(0,0,0,0.55)]'
          : 'shadow-[0_2px_10px_-4px_rgba(0,0,0,0.35)]',
      )}
      style={{ backgroundColor: '#0d0d09' }}
    >
      <div className="flex w-full items-center justify-between gap-6 px-3">
        {/* Left: section nav */}
        <nav className="flex items-center gap-0.5 min-w-0">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            const isActive =
              location.pathname === item.href ||
              (item.href === '/dashboard' && location.pathname === '/')

            const inner = (
              <span
                className={cn(
                  'group relative inline-flex items-center gap-2 h-7 px-2.5 rounded-lg',
                  'font-poppins font-medium text-[13px] tracking-[-0.01em]',
                  'transition-colors duration-150 ease-out',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/40',
                  isActive
                    ? 'bg-[#fffcf9] text-[#0d0d09] font-semibold'
                    : 'text-white/72 hover:bg-white/[0.08] hover:text-white',
                )}
              >
                <span className="relative">
                  <Icon className="h-3.5 w-3.5" />
                  {item.notification && (
                    <span
                      aria-hidden
                      className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#D7C5FB] ring-2 ring-[#0d0d09]"
                    />
                  )}
                </span>
                <span className="hidden lg:inline">{item.label}</span>
                {item.dropdown && (
                  <ChevronDown className="hidden lg:inline h-3 w-3 opacity-65" />
                )}
              </span>
            )

            if (item.dropdown) {
              return (
                <Popover key={item.href}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      onClick={(e) => {
                        // primary click navigates, chevron opens — keep simple: navigate
                        e.preventDefault()
                        navigate(item.href)
                      }}
                    >
                      {inner}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" sideOffset={8} className="p-2 w-64">
                    {item.dropdown()}
                  </PopoverContent>
                </Popover>
              )
            }

            return (
              <Link
                key={item.href}
                to={item.href}
                aria-current={isActive ? 'page' : undefined}
                title={item.label}
              >
                {inner}
              </Link>
            )
          })}
        </nav>

        {/* Right: utility cluster */}
        <div className="flex items-center gap-2 text-white">
          <div className="hidden md:block [&_input]:bg-white/[0.08] [&_input]:border-white/[0.12] [&_input]:text-white [&_input::placeholder]:text-white/50 [&_svg]:text-white/70">
            <GlobalSearchBar />
          </div>

          <GlobalCreateButton />

          <div className="[&_*]:!text-white/85">
            <SourcingCreditIndicator />
          </div>

          <div className="[&_button]:text-white/85 [&_button:hover]:bg-white/[0.08] [&_button:hover]:text-white [&_svg]:text-white/85 [&_button]:h-7 [&_button]:w-7">
            <NotificationCenter />
          </div>

          {isPlatformAdmin && uniqueOrgs.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="hidden md:inline-flex h-7 px-2.5 border-white/15 bg-transparent text-white text-[12px] font-poppins font-semibold hover:bg-white/[0.08] hover:text-white"
                >
                  {currentOrgName}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
                {uniqueOrgs.map((o) => (
                  <DropdownMenuItem
                    key={o.id}
                    onClick={() => switchWorkspace(o.id)}
                    data-state={o.id === organizationId ? 'checked' : undefined}
                  >
                    {o.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account"
                className="relative h-7 w-7 rounded-full p-0 transition-all hover:ring-2 hover:ring-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/40"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={profile?.avatar_url} alt={userDisplayName} />
                  <AvatarFallback className="text-[10px] bg-virgilio-purple text-white font-poppins font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <div className="px-2 pt-1.5 pb-2">
                <p className="text-[12.5px] font-poppins font-semibold text-virgilio-text leading-tight truncate">
                  {userDisplayName}
                </p>
                <p className="text-[11px] font-inter leading-tight text-[hsl(var(--menu-group-color))] truncate">
                  {user?.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings className="h-3.5 w-3.5" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
