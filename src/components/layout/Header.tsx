
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  permission?: keyof ReturnType<typeof usePermissions>
}

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const { profile } = useUserProfile()
  const permissions = usePermissions()
  const location = useLocation()

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/' },
    { label: 'Jobs', href: '/jobs', permission: 'canViewJobs' },
    { label: 'Members', href: '/admin/members', permission: 'canManageMembers' },
    { label: 'Organizations', href: '/admin/organizations', permission: 'canManageOrganization' },
    { label: 'Settings', href: '/settings' },
  ]

  const handleLogout = async () => {
    await logout()
  }

  const getUserInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase()
    }
    if (profile?.first_name) {
      return profile.first_name.substring(0, 2).toUpperCase()
    }
    if (!user?.email) return 'U'
    return user.email.substring(0, 2).toUpperCase()
  }

  const isActivePath = (href: string) => {
    if (href === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(href)
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface-primary border-b border-border/10 shadow-neumorphic">
      <div className="mx-auto max-w-7xl px-layout-sm sm:px-layout-md lg:px-layout-lg">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="heading-lg font-bold text-primary hover:scale-105 transition-transform duration-default">
              Virgilio.io
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-lg">
            {navItems.map((item) => {
              if (item.permission) {
                return (
                  <PermissionGate key={item.href} permission={item.permission}>
                    <Link
                      to={item.href}
                      className={cn(
                        "px-3 py-2 rounded-brand text-sm font-medium transition-all duration-default",
                        isActivePath(item.href)
                          ? "bg-accent text-accent-foreground shadow-neumorphic-active"
                          : "text-text-secondary hover:text-text-primary hover:bg-accent/50 hover:shadow-neumorphic-hover hover:-translate-y-0.5"
                      )}
                    >
                      {item.label}
                    </Link>
                  </PermissionGate>
                )
              }
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "px-3 py-2 rounded-brand text-sm font-medium transition-all duration-default",
                    isActivePath(item.href)
                      ? "bg-accent text-accent-foreground shadow-neumorphic-active"
                      : "text-text-secondary hover:text-text-primary hover:bg-accent/50 hover:shadow-neumorphic-hover hover:-translate-y-0.5"
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* User Avatar & Mobile Menu Button */}
          <div className="flex items-center space-x-sm">
            {/* User Avatar Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url || ''} />
                    <AvatarFallback className="bg-accent text-accent-foreground font-medium">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex flex-col space-y-1 p-3">
                  <p className="text-sm font-medium leading-none">{user?.email}</p>
                  <p className="text-xs leading-normal text-muted-foreground">
                    {user?.user_metadata?.user_type || 'guest'}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border/10 bg-surface-primary">
            <nav className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => {
                if (item.permission) {
                  return (
                    <PermissionGate key={item.href} permission={item.permission}>
                      <Link
                        to={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "block px-3 py-2 rounded-brand text-md font-medium transition-all duration-default",
                          isActivePath(item.href)
                            ? "bg-accent text-accent-foreground shadow-neumorphic-active"
                            : "text-text-secondary hover:text-text-primary hover:bg-accent/50"
                        )}
                      >
                        {item.label}
                      </Link>
                    </PermissionGate>
                  )
                }
                
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "block px-3 py-2 rounded-brand text-md font-medium transition-all duration-default",
                      isActivePath(item.href)
                        ? "bg-accent text-accent-foreground shadow-neumorphic-active"
                        : "text-text-secondary hover:text-text-primary hover:bg-accent/50"
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
