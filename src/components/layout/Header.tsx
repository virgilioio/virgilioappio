
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
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { VirgilioLogo } from '@/components/VirgilioLogo'
import { AdminModeIndicator } from '@/components/admin/AdminModeIndicator'
import { GlobalCreateButton } from '@/components/layout/GlobalCreateButton'

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
      const { error } = await supabase.functions.invoke('set-current-organization', {
        body: { organizationId: orgId }
      })
      if (error) throw error
      // Refresh the auth session so updated user_metadata is available immediately
      await supabase.auth.refreshSession()
      toast({ title: 'Workspace switched', description: 'Reloading your data...' })
      window.location.reload()
    } catch (e) {
      console.error('Failed to switch workspace', e)
      toast({ title: 'Failed to switch', description: 'Please try again or contact support.', variant: 'destructive' })
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
                className={`relative flex items-center gap-2 px-2 py-1 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-primary-foreground/80 after:rounded-full'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
      "fixed top-0 left-0 right-0 z-50 border-b border-border transition-shadow supports-[backdrop-filter]:bg-surface-primary/60 bg-surface-primary/90 backdrop-blur",
      scrolled && "shadow-sm"
    )}>
      <div className="flex items-center justify-between px-md py-2 sm:px-lg">
        {/* Logo and Desktop Navigation */}
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-sm">
            <VirgilioLogo className="h-6 w-auto" />
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
                    className={`relative flex items-center gap-2 px-2 py-1 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-primary-foreground/80 after:rounded-full'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
          
          {/* Workspace Switcher */}
          {isPlatformAdmin && uniqueOrgs.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="hidden sm:inline-flex">
                  {currentOrgName}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
                {uniqueOrgs.map((o) => (
                  <DropdownMenuItem key={o.id} onClick={() => switchWorkspace(o.id)}>
                    {o.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}


          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profile?.avatar_url} alt={userDisplayName} />
                  <AvatarFallback className="text-sm">{userInitials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userDisplayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2 w-full">
                  <User className="h-3.5 w-3.5" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2 w-full">
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut} className="text-red-600 focus:text-red-600">
                <LogOut className="h-3.5 w-3.5 mr-2" />
                {isLoggingOut ? 'Logging out...' : 'Log out'}
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
            <SheetContent side="left" className="w-64">
              <div className="flex flex-col gap-md">
                <Link to="/dashboard" className="flex items-center gap-sm" onClick={() => setIsSheetOpen(false)}>
                  <VirgilioLogo className="h-6 w-auto" />
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
