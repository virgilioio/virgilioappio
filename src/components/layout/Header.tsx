
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'
import { Link, useNavigate } from 'react-router-dom'
import { Settings, LogOut, User, Users, Building2, Briefcase, Receipt, ShieldCheck } from 'lucide-react'
import { VirgilioLogo } from '@/components/VirgilioLogo'
import { AdminModeIndicator } from '@/components/admin/AdminModeIndicator'

export function Header() {
  const { signOut } = useAuth()
  const { profile } = useUserProfile()
  const permissions = usePermissions()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-4">
        <VirgilioLogo className="h-8 w-auto" />
        <AdminModeIndicator />
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'User'} />
                <AvatarFallback>
                  {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {profile?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              
              {permissions.canViewMembers && (
                <DropdownMenuItem asChild>
                  <Link to="/members" className="cursor-pointer">
                    <Users className="mr-2 h-4 w-4" />
                    <span>Members</span>
                  </Link>
                </DropdownMenuItem>
              )}
              
              {permissions.canManageOrganization && (
                <DropdownMenuItem asChild>
                  <Link to="/organizations" className="cursor-pointer">
                    <Building2 className="mr-2 h-4 w-4" />
                    <span>Organizations</span>
                  </Link>
                </DropdownMenuItem>
              )}
              
              {permissions.canViewJobs && (
                <DropdownMenuItem asChild>
                  <Link to="/jobs" className="cursor-pointer">
                    <Briefcase className="mr-2 h-4 w-4" />
                    <span>Jobs</span>
                  </Link>
                </DropdownMenuItem>
              )}
              
              {permissions.canViewBilling && (
                <DropdownMenuItem asChild>
                  <Link to="/billing" className="cursor-pointer">
                    <Receipt className="mr-2 h-4 w-4" />
                    <span>Billing</span>
                  </Link>
                </DropdownMenuItem>
              )}
              
              {permissions.isPlatformAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    <span>Platform Settings</span>
                  </Link>
                </DropdownMenuItem>
              )}
              
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
