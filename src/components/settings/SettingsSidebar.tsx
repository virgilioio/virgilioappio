
import { User, Building, Building2, Receipt, Users, Shield, Settings as SettingsIcon, Megaphone, FileText, Image, Globe, BarChart3, UserCheck, Briefcase, UsersIcon, CreditCard, Layers } from 'lucide-react'
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
    ['platform-dashboard', 'platform-settings', 'platform-job-settings', 'platform-customers', 'platform-saas-customers'].includes(currentTab)
  )
  const [workspaceOpen, setWorkspaceOpen] = useState(
    ['workspace-job-settings', 'organization', 'members'].includes(currentTab)
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
      id: 'organizations', 
      label: 'Organizations', 
      icon: Building2, 
      show: permissions.canViewOrganizations 
    },
    { 
      id: 'billing', 
      label: 'Billing', 
      icon: Receipt, 
      show: userType === 'workspace_owner' && !!organizationId
    },
    { 
      id: 'workspace', 
      label: 'Workspace', 
      icon: Layers, 
      show: permissions.isPlatformAdmin || (userType === 'workspace_owner' && !!organizationId),
      submenu: [
        { id: 'organization', label: 'Company Profile', icon: Building, show: permissions.canManageOrganization },
        { id: 'members', label: 'Members', icon: Users, show: permissions.canViewMembers },
        { id: 'workspace-job-settings', label: 'Job Settings', icon: SettingsIcon, show: permissions.isPlatformAdmin || (userType === 'workspace_owner' && !!organizationId) },
      ]
    },
    { 
      id: 'platform', 
      label: 'Platform', 
      icon: Shield, 
      show: permissions.isPlatformAdmin,
      submenu: [
        { id: 'platform-dashboard', label: 'Dashboard', icon: BarChart3, show: true },
        { id: 'platform-settings', label: 'App Personalization', icon: SettingsIcon, show: true },
        { id: 'platform-job-settings', label: 'Job Settings', icon: Briefcase, show: true },
        { id: 'platform-saas-customers', label: 'SaaS Customers', icon: UsersIcon, show: true },
        { id: 'platform-customers', label: 'Legacy Customer Management', icon: Building2, show: permissions.canAccessCustomerManagement },
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
  

  const handleWorkspaceToggle = () => {
    setWorkspaceOpen(!workspaceOpen)
  }

  const handlePlatformToggle = () => {
    setPlatformOpen(!platformOpen)
  }

  const handleItemClick = (itemId: string) => {
    if (itemId === 'workspace') {
      handleWorkspaceToggle()
      if (!workspaceOpen) {
        // Default to first available workspace submenu item
        const workspaceSubmenu = navItems.find(item => item.id === 'workspace')?.submenu
        const firstAvailableItem = workspaceSubmenu?.find(subItem => subItem.show)
        if (firstAvailableItem) {
          onTabChange(firstAvailableItem.id)
        }
      }
    } else if (itemId === 'platform') {
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
              const isOpen = item.id === 'workspace' ? workspaceOpen : platformOpen
              const setOpen = item.id === 'workspace' ? setWorkspaceOpen : setPlatformOpen
              
              return (
                <Collapsible key={item.id} open={isOpen} onOpenChange={setOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-between h-10 px-3 py-2",
                        "text-sm font-medium transition-all",
                        isOpen
                          ? "bg-muted text-foreground" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted hover:-translate-y-0.5"
                      )}
                      onClick={() => handleItemClick(item.id)}
                    >
                      <div className="flex items-center">
                        <Icon className="h-4 w-4 mr-3 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform",
                        isOpen && "rotate-180"
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
                            "text-sm font-medium transition-all",
                            isActive 
                              ? "bg-virgilio-purple text-white shadow-sm" 
                              : "text-muted-foreground hover:text-foreground hover:bg-muted hover:-translate-y-0.5"
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
                  "text-sm font-medium transition-all",
                  isActive 
                    ? "bg-virgilio-purple text-white shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted hover:-translate-y-0.5"
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
