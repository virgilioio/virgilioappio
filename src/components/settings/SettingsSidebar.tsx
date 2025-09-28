
import { User, Building, Building2, Receipt, Users, Shield, Settings as SettingsIcon, Megaphone, FileText, Image, Globe, BarChart3, UserCheck, Briefcase, UsersIcon, CreditCard } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface SettingsNavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  show: boolean
  submenu?: SettingsNavItem[]
}

interface SettingsSidebarProps {
  currentTab: string
  onTabChange: (tab: string) => void
  className?: string
}

export function SettingsSidebar({ currentTab, onTabChange, className }: SettingsSidebarProps) {
  const permissions = usePermissions()
  const { organizationId, userType } = useAuth()
  const [platformOpen, setPlatformOpen] = useState(
    ['platform-dashboard', 'platform-settings', 'platform-templates', 'platform-job-settings', 'platform-customers'].includes(currentTab)
  )

  const isWorkspaceOwnerOfSaaSOrg = () => {
    return userType === 'workspace_owner' && organizationId
  }

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
      id: 'organizations', 
      label: 'Organizations', 
      icon: Building2, 
      show: permissions.canViewOrganizations 
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
      show: permissions.isPlatformAdmin || permissions.canCreateOrganizations,
      submenu: [
        { id: 'platform-dashboard', label: 'Dashboard', icon: BarChart3, show: true },
        { id: 'platform-settings', label: 'App Personalization', icon: SettingsIcon, show: true },
        { id: 'platform-templates', label: 'Templates', icon: FileText, show: true },
        { id: 'platform-job-settings', label: 'Job Settings', icon: Briefcase, show: true },
        { id: 'platform-customers', label: 'Customer Management (SaaS)', icon: UsersIcon, show: permissions.canAccessCustomerManagement },
      ]
    },
  ]

  // Add subscription item conditionally
  if (isWorkspaceOwnerOfSaaSOrg()) {
    navItems.push({ 
      id: 'subscription', 
      label: 'Subscription', 
      icon: CreditCard, 
      show: true
    })
  }

  const filteredNavItems = navItems.filter(item => item.show)
  

  const handlePlatformToggle = () => {
    setPlatformOpen(!platformOpen)
  }

  const handleItemClick = (itemId: string) => {
    if (itemId === 'platform') {
      handlePlatformToggle()
      if (!platformOpen) {
        onTabChange('platform-dashboard') // Default to dashboard when opening platform
      }
    } else {
      onTabChange(itemId)
    }
  }

  return (
    <Card className={cn("w-64 h-fit", className)}>
      <CardContent className="p-4">
        <div className="space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon
            
            if (item.submenu) {
              return (
                <Collapsible key={item.id} open={platformOpen} onOpenChange={setPlatformOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-between h-10 px-3 py-2",
                        "text-sm font-medium transition-colors",
                        platformOpen
                          ? "bg-muted text-foreground" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                      onClick={() => handleItemClick(item.id)}
                    >
                      <div className="flex items-center">
                        <Icon className="h-4 w-4 mr-3 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform",
                        platformOpen && "rotate-180"
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 ml-6 mt-1">
                    {item.submenu.filter(subItem => subItem.show).map((subItem) => {
                      const SubIcon = subItem.icon
                      const isActive = currentTab === subItem.id
                      
                      return (
                        <Button
                          key={subItem.id}
                          variant={isActive ? "default" : "ghost"}
                          className={cn(
                            "w-full justify-start h-9 px-3 py-2",
                            "text-sm font-medium transition-colors",
                            isActive 
                              ? "bg-primary text-primary-foreground shadow-sm" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                          onClick={() => onTabChange(subItem.id)}
                        >
                          <SubIcon className="h-3.5 w-3.5 mr-2 shrink-0" />
                          <span className="truncate">{subItem.label}</span>
                        </Button>
                      )
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )
            }

            const isActive = currentTab === item.id
            
            return (
              <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start h-10 px-3 py-2",
                  "text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                onClick={() => handleItemClick(item.id)}
              >
                <Icon className="h-4 w-4 mr-3 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
