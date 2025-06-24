
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/hooks/useOrganization'
import { useIsMounted } from '@/hooks/useIsMounted'
import { useAdminChecker } from '@/hooks/useAdminChecker'
import { VirgilioLogo } from '@/components/VirgilioLogo'
import { OrganizationDebug } from '@/components/debug/OrganizationDebug'
import {
  SunMedium,
  MoonStar,
  Menu,
  Settings,
  CreditCard,
  LogOut,
  ShieldCheck,
  Plus,
} from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'

export function Header() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const { organization } = useOrganization()
  const { isPlatformAdmin, isWorkspaceOwner } = useAdminChecker()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const isMounted = useIsMounted()

  const handleSignOut = async () => {
    try {
      await logout()
    } catch (error: any) {
      toast({
        title: 'Error signing out',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <header className="fixed top-0 right-0 left-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex h-12 sm:h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          
          <Link to="/" className="flex items-center gap-2">
            <VirgilioLogo className="h-6 w-6 sm:h-8 sm:w-8" />
            <span className="font-bold text-lg sm:text-xl hidden sm:block">Virgilio</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          {isPlatformAdmin && (
            <Link to="/organizations">
              <Button variant="ghost" size="sm">
                Organizations
              </Button>
            </Link>
          )}
          {isPlatformAdmin && (
            <Link to="/invoices">
              <Button variant="ghost" size="sm">
                Invoices
              </Button>
            </Link>
          )}
          {isWorkspaceOwner && (
            <Link to="/job-requests">
              <Button variant="ghost" size="sm">
                Job Requests
              </Button>
            </Link>
          )}
          <Link to="/jobs">
            <Button variant="ghost" size="sm">
              Jobs
            </Button>
          </Link>
          <Link to="/members">
            <Button variant="ghost" size="sm">
              Members
            </Button>
          </Link>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {isPlatformAdmin && (
            <ShieldCheck className="text-green-500 h-4 w-4 mr-1" />
          )}
          <Switch
            id="theme"
            checked={theme === 'dark'}
            onCheckedChange={toggleTheme}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email || 'Avatar'} />
                  <AvatarFallback>{user?.email?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-4 py-2">
                <div className="font-bold text-sm">{user?.email}</div>
                <div className="text-muted-foreground text-xs">
                  {user?.user_metadata?.full_name || 'No Name'}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              {isWorkspaceOwner && (
                <DropdownMenuItem asChild>
                  <Link to="/billing">
                    <CreditCard className="h-4 w-4 mr-2" />
                    <span>Billing</span>
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                <span>Log out</span>
              </DropdownMenuItem>
              {process.env.NODE_ENV === 'development' && isMounted && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <OrganizationDebug />
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile Navigation Sheet */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            className="md:hidden h-8 w-8 p-0 rounded-full"
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Open mobile menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>
              Explore the platform and manage your organization.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <Link to="/jobs" onClick={closeMobileMenu}>
              <Button variant="ghost" className="justify-start">
                Jobs
              </Button>
            </Link>
            <Link to="/members" onClick={closeMobileMenu}>
              <Button variant="ghost" className="justify-start">
                Members
              </Button>
            </Link>
            {isPlatformAdmin && (
              <Link to="/organizations" onClick={closeMobileMenu}>
                <Button variant="ghost" className="justify-start">
                  Organizations
                </Button>
              </Link>
            )}
            {isPlatformAdmin && (
              <Link to="/invoices" onClick={closeMobileMenu}>
                <Button variant="ghost" className="justify-start">
                  Invoices
                </Button>
              </Link>
            )}
            {isWorkspaceOwner && (
              <Link to="/job-requests" onClick={closeMobileMenu}>
                <Button variant="ghost" className="justify-start">
                  Job Requests
                </Button>
              </Link>
            )}
            <Link to="/settings" onClick={closeMobileMenu}>
              <Button variant="ghost" className="justify-start">
                Settings
              </Button>
            </Link>
            {isWorkspaceOwner && (
              <Link to="/billing" onClick={closeMobileMenu}>
                <Button variant="ghost" className="justify-start">
                  Billing
                </Button>
              </Link>
            )}
            <Button variant="ghost" className="justify-start" onClick={handleSignOut}>
              Log out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
