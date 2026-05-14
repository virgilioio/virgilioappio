
import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
  Menu,
  Home,
  Briefcase,
  Building2,
  FileText,
  Settings,
  Receipt,
  LogOut,
  User,
  Users,
  TrendingUp,
  Sparkles,
  BarChart3,
  Lightbulb,
  Handshake,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { GoGioLogo } from '@/components/GoGioLogo'
import { AdminModeIndicator } from '@/components/admin/AdminModeIndicator'
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
    canViewCandidates
  } = usePermissions()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { members } = useMembers()
  const { toast } = useToast()
  const { profile } = useUserProfile()
  const { hasRecruiterRole, isPrivileged } = useUserJobRoles()
  
  // Members without recruiter role cannot see Find/Candidates
  const canSeeRecruiterTools = isPrivileged || hasRecruiterRole

  const handleLogout = async () => {
    await logout()
    
    // ✅ Belt-and-suspenders: explicit navigation after 100ms
    // (in case onAuthStateChange doesn't trigger redirect)
    setTimeout(() => {
      if (import.meta.env.DEV) {
        console.debug('[Header] Fallback navigation to /auth after logout')
      }
      navigate('/auth', { replace: true })
    }, 100)
  }

  // Header scroll shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 2)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Workspace switcher data
  const myOrgMemberships = (members || []).filter(m => m.user_id === user?.id && m.user_status === 'active')
  const uniqueOrgs = Array.from(new Map(myOrgMemberships.map(m => [m.organization_id, { id: m.organization_id, name: m.organization_name || m.organization_id.slice(0,8) }] )).values())
  const currentOrgName = uniqueOrgs.find(o => o.id === organizationId)?.name || 'Select workspace'

  const switchWorkspace = async (orgId: string) => {
    try {
      // Add 8 second timeout
      const switchPromise = supabase.functions.invoke('set-current-organization', {
        body: { organizationId: orgId }
      });
      
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Switch timeout')), 8000)
      );
      
      const { error } = await Promise.race([switchPromise, timeout]) as any;
      if (error) throw error;
      
      // Refresh the auth session so updated user_metadata is available immediately
      await supabase.auth.refreshSession()
      toast({ title: 'Workspace switched', description: 'Reloading your data...' })
      window.location.reload()
    } catch (e) {
      console.error('[Workspace Switch] Failed:', e);
      if (e instanceof Error && e.message.includes('timeout')) {
        console.error('[Workspace Switch] Edge function timeout after 8s');
        toast({ 
          title: 'Switch timeout', 
          description: 'The operation took too long. Please try again.',
          variant: 'destructive'
        })
      } else {
        toast({ 
          title: 'Failed to switch', 
          description: 'Please try again or contact support.', 
          variant: 'destructive' 
        })
      }
    }
  }

  const navigationItems: Array<{
    href: string
    icon: typeof Home
    label: string
    show: boolean
    section: Exclude<AppSection, null>
  }> = [
    {
      href: '/find',
      icon: Sparkles,
      label: 'Find',
      show: canSeeRecruiterTools && (isPlatformAdmin || isWorkspaceOwner || isAdmin || isMember),
      section: 'ats',
    },
    {
      href: '/jobs',
      icon: Briefcase,
      label: 'Jobs',
      show: canViewJobs,
      section: 'ats',
    },
    {
      href: '/candidates',
      icon: Users,
      label: 'Candidates',
      show: canSeeRecruiterTools && canViewCandidatesNavigation,
      section: 'ats',
    },
    {
      href: '/pipeline',
      icon: TrendingUp,
      label: 'Pipeline',
      show: canViewJobs,
      section: 'ats',
    },
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
  const visibleNavItems = navigationItems.filter(item => item.show && item.section === activeSection)

  const userDisplayName = (profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.first_name) || user?.email?.split('@')[0] || 'User'
  const userInitials = profile?.first_name && profile?.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U'

  const NavigationContent = () => (
    <>
      {isPlatformAdmin && <AdminModeIndicator />}
      <nav className="space-y-1">
        {visibleNavItems
          .map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href || 
              (item.href === '/dashboard' && location.pathname === '/')
            
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setIsSheetOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex items-center gap-2 px-2 py-1 text-sm font-poppins font-medium tracking-tight rounded-md transition-all duration-200 ease-out ${
                  isActive
                    ? 'bg-virgilio-purple text-white font-semibold after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-white after:rounded-full'
                    : 'text-virgilio-text hover:bg-virgilio-purple/10 hover:-translate-y-0.5 hover:text-virgilio-text'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            )
          })}
      </nav>
    </>
  )

  return (
    <header
      className={cn(
        "hidden sm:flex fixed top-3 right-3 left-[5.5rem] z-50 h-12 items-center rounded-2xl shadow-calendly ring-1 ring-black/40 transition-shadow",
        scrolled && "shadow-lg"
      )}
      style={{ backgroundColor: '#0d0d09' }}
    >
      <div className="flex w-full items-center justify-between px-3">
        {/* Desktop Navigation */}
        <div className="flex items-center gap-6">
          <nav className="hidden lg:flex items-center gap-1">
            {visibleNavItems
              .map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href ||
                  (item.href === '/dashboard' && location.pathname === '/')

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2.5 py-1 text-sm font-poppins font-medium tracking-tight transition-colors duration-200 ease-out',
                      isActive
                        ? 'bg-[#fffcf9] text-black font-semibold'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                )
              })}
          </nav>
        </div>

        {/* User Menu and Mobile Navigation */}
        <div className="flex items-center gap-2 text-white">
          <div className="hidden sm:block [&_input]:bg-white/10 [&_input]:border-white/15 [&_input]:text-white [&_input::placeholder]:text-white/50 [&_svg]:text-white/70">
            <GlobalSearchBar />
          </div>

          <div className="hidden sm:block [&_button]:text-white [&_button:hover]:bg-white/10">
            <GlobalCreateButton />
          </div>

          <div className="hidden sm:block [&_*]:!text-white/80 [&_button:hover]:bg-white/10">
            <SourcingCreditIndicator />
          </div>

          <div className="hidden sm:block [&_button]:text-white/80 [&_button:hover]:bg-white/10 [&_svg]:text-white/80">
            <NotificationCenter />
          </div>

          {/* Workspace Switcher */}
          {isPlatformAdmin && uniqueOrgs.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="hidden sm:inline-flex h-8 border-white/15 bg-transparent text-white font-poppins font-semibold hover:bg-white/10 hover:text-white"
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
                    data-state={o.id === organizationId ? "checked" : undefined}
                  >
                    {o.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* User Menu */}
          <div className="hidden sm:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0 hover:bg-white/10 hover:ring-2 hover:ring-white/20 transition-all">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url} alt={userDisplayName} />
                    <AvatarFallback className="text-xs bg-virgilio-purple text-white font-poppins font-semibold">{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="px-2 pt-1.5 pb-2">
                  <p className="text-[12.5px] font-poppins font-semibold text-virgilio-text leading-tight truncate">{userDisplayName}</p>
                  <p className="text-[11px] font-inter leading-tight text-[hsl(var(--menu-group-color))] truncate">{user?.email}</p>
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
      </div>
    </header>
  )
}
