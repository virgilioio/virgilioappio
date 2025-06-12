
import { User, Building, Receipt, Users, Shield } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface SettingsNavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  show: boolean
}

interface SettingsSidebarProps {
  currentTab: string
  onTabChange: (tab: string) => void
  className?: string
}

export function SettingsSidebar({ currentTab, onTabChange, className }: SettingsSidebarProps) {
  const permissions = usePermissions()

  const navItems: SettingsNavItem[] = [
    { 
      id: 'profile', 
      label: 'My Profile', 
      icon: User, 
      show: true 
    },
    { 
      id: 'organization', 
      label: 'Organization', 
      icon: Building, 
      show: permissions.canManageOrganization 
    },
    { 
      id: 'billing', 
      label: 'Billing', 
      icon: Receipt, 
      show: permissions.canViewBilling 
    },
    { 
      id: 'members', 
      label: 'Members', 
      icon: Users, 
      show: permissions.canViewMembers 
    },
    { 
      id: 'platform', 
      label: 'Platform', 
      icon: Shield, 
      show: permissions.isPlatformAdmin || permissions.canCreateOrganizations 
    },
  ].filter(item => item.show)

  return (
    <nav className={cn("flex flex-col gap-1 p-2", className)}>
      {navItems.map((item) => {
        const isActive = currentTab === item.id
        const Icon = item.icon
        
        return (
          <Button
            key={item.id}
            variant={isActive ? "default" : "ghost"}
            className={cn(
              "w-full justify-start h-10 px-2 py-1",
              "text-sm font-medium",
              isActive 
                ? "bg-accent text-accent-foreground shadow-neumorphic" 
                : "text-text-secondary hover:text-text-primary hover:bg-accent/50"
            )}
            onClick={() => onTabChange(item.id)}
          >
            <Icon className="h-4 w-4 mr-2 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Button>
        )
      })}
    </nav>
  )
}
