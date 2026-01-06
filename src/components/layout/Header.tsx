
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
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
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
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { GoGioLogo } from '@/components/GoGioLogo'
import { AdminModeIndicator } from '@/components/admin/AdminModeIndicator'
import { GlobalCreateButton } from '@/components/layout/GlobalCreateButton'
import { SourcingCreditIndicator } from '@/components/layout/SourcingCreditIndicator'

import { cn } from '@/lib/utils'
import { useMembers } from '@/hooks/useMembers'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabaseClient'
import { useUserProfile } from '@/hooks/useUserProfile'

export function Header() {
  const { user, logout, organizationId, isLoggingOut } = useAuth()
  const { 
    canViewJobs, 
    canViewOrganizations, 
    canViewCandidatesNavigation,
    isPlatformAdmin,
    isWorkspaceOwner,
    isAdmin,
    isRecruiter,
    canViewCandidates
  } = usePermissions()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { members } = useMembers()
  const { toast } = useToast()
  const { profile } = useUserProfile()

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

  const navigationItems = [
    {
      href: '/dashboard',
      icon: Home,
      label: 'Home',
      show: true,
    },
    {
      href: '/find',
      icon: Sparkles,
      label: 'Find',
      show: isPlatformAdmin || isWorkspaceOwner || isAdmin || isRecruiter,
    },
    {
      href: '/jobs',
      icon: Briefcase,
      label: 'Jobs',
      show: canViewJobs,
    },
    {
      href: '/pipeline',
      icon: TrendingUp,
      label: 'Pipeline',
      show: canViewJobs,
    },
    {
      href: '/candidates',
      icon: Users,
      label: 'Candidates',
      show: canViewCandidatesNavigation,
    },
    {
      href: '/analytics',
      icon: BarChart3,
      label: 'Analytics',
      show: isPlatformAdmin,
    },
  ]

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
        {navigationItems
          .filter(item => item.show)
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
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 border-b border-virgilio-border transition-shadow supports-[backdrop-filter]:bg-surface-primary/60 bg-surface-primary/90 backdrop-blur",
      scrolled && "shadow-calendly"
    )}>
      <div className="flex items-center justify-between px-md py-2 sm:px-lg">
        {/* Logo and Desktop Navigation */}
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-sm">
            <GoGioLogo className="h-6 w-auto" />
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navigationItems
              .filter(item => item.show)
              .map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href || 
                  (item.href === '/dashboard' && location.pathname === '/')
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
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
        </div>

        {/* User Menu and Mobile Navigation */}
        <div className="flex items-center gap-md">
          {/* Global Create Button */}
          <GlobalCreateButton />
          
          {/* Sourcing Credit Indicator */}
          <SourcingCreditIndicator />
          
          {/* Workspace Switcher */}
          {isPlatformAdmin && uniqueOrgs.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hidden sm:inline-flex font-poppins font-semibold">
                  {currentOrgName}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="shadow-calendly border-virgilio-border">
                <DropdownMenuLabel className="font-poppins font-semibold text-virgilio-text">Switch workspace</DropdownMenuLabel>
                {uniqueOrgs.map((o) => (
                  <DropdownMenuItem 
                    key={o.id} 
                    onClick={() => switchWorkspace(o.id)}
                    className={cn(
                      "font-poppins hover:bg-virgilio-purple/5 hover:text-virgilio-text transition-colors cursor-pointer",
                      o.id === organizationId && "bg-virgilio-purple/10 text-virgilio-purple font-semibold"
                    )}
                  >
                    {o.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}


          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:ring-2 hover:ring-virgilio-purple/20 transition-all">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profile?.avatar_url} alt={userDisplayName} />
                  <AvatarFallback className="text-sm bg-virgilio-purple text-white font-poppins font-semibold">{userInitials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52 shadow-calendly border-virgilio-border" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-poppins font-semibold text-virgilio-text leading-none">{userDisplayName}</p>
                  <p className="text-xs font-poppins leading-none text-virgilio-muted">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-virgilio-border" />
              <DropdownMenuItem asChild className="hover:bg-virgilio-purple/5 hover:text-virgilio-text transition-colors cursor-pointer">
                <Link to="/settings" className="flex items-center gap-2 w-full">
                  <Settings className="h-3.5 w-3.5" />
                  <span className="font-poppins">Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-virgilio-border" />
              <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut} className="text-virgilio-error hover:bg-virgilio-error/10 hover:text-virgilio-error transition-colors cursor-pointer">
                <LogOut className="h-3.5 w-3.5 mr-2" />
                <span className="font-poppins">{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Navigation */}
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden h-7 w-7">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 shadow-calendly">
              <div className="flex flex-col gap-md">
                <Link to="/dashboard" className="flex items-center gap-sm" onClick={() => setIsSheetOpen(false)}>
                  <GoGioLogo className="h-6 w-auto" />
                </Link>
                <NavigationContent />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
