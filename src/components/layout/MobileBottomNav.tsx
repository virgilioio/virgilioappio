import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { TrendingUp, BarChart3, LogOut, Settings, Search } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { cn } from '@/lib/utils'
import { SearchResultsDialog } from '@/components/search/SearchResultsDialog'
import gioAvatar from '@/assets/gio-avatar.png'

export function MobileBottomNav() {
  const { user, logout, isLoggingOut } = useAuth()
  const { profile } = useUserProfile()
  const location = useLocation()
  const navigate = useNavigate()
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    setTimeout(() => navigate('/auth', { replace: true }), 100)
  }

  const userDisplayName = (profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile?.first_name) || user?.email?.split('@')[0] || 'User'
  const userInitials = profile?.first_name && profile?.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U'

  const isActive = (href: string) =>
    location.pathname === href || (href === '/dashboard' && location.pathname === '/')

  return (
    <>
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 px-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
      >
        <nav className="flex items-end justify-around h-14 bg-surface-primary/80 backdrop-blur-xl rounded-2xl border border-virgilio-border shadow-lg">
          {/* Pipeline */}
          <Link
            to="/pipeline"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs font-poppins font-medium transition-colors',
              isActive('/pipeline') ? 'text-virgilio-purple' : 'text-virgilio-muted'
            )}
          >
            <TrendingUp className="h-5 w-5" />
            <span>Pipeline</span>
          </Link>

          {/* Analytics */}
          <Link
            to="/analytics"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs font-poppins font-medium transition-colors',
              isActive('/analytics') ? 'text-virgilio-purple' : 'text-virgilio-muted'
            )}
          >
            <BarChart3 className="h-5 w-5" />
            <span>Analytics</span>
          </Link>

          {/* Home — Center with larger Gio avatar */}
          <Link
            to="/dashboard"
            className="flex flex-col items-center justify-center flex-1 -mt-6 relative"
          >
            <div className={cn(
              'h-11 w-11 rounded-full ring-2 ring-offset-2 ring-offset-surface-primary overflow-hidden transition-all',
              isActive('/dashboard') ? 'ring-virgilio-purple shadow-md' : 'ring-virgilio-border'
            )}>
              <img src={gioFacePurple} alt="Home" className="h-full w-full object-cover" />
            </div>
          </Link>

          {/* Search */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs font-poppins font-medium text-virgilio-muted transition-colors"
          >
            <Search className="h-5 w-5" />
            <span>Search</span>
          </button>

          {/* Profile avatar tab */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs font-poppins font-medium text-virgilio-muted">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={profile?.avatar_url} alt={userDisplayName} />
                  <AvatarFallback className="text-[10px] bg-virgilio-purple text-white font-poppins font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span>Profile</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-52 shadow-calendly border-virgilio-border">
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
        </nav>
      </div>

      <SearchResultsDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        initialQuery=""
      />
    </>
  )
}
