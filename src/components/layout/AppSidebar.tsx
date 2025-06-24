
import { 
  Building2, 
  Users, 
  Briefcase, 
  FileText, 
  Receipt, 
  Settings as SettingsIcon,
  LayoutDashboard,
  ChevronRight
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

const platformItems = [
  { 
    title: 'Dashboard', 
    url: '/dashboard', 
    icon: LayoutDashboard,
    permission: null // Always visible
  },
  { 
    title: 'Organizations', 
    url: '/organizations', 
    icon: Building2,
    permission: 'canCreateOrganizations'
  },
  { 
    title: 'Job Requests', 
    url: '/job-requests', 
    icon: FileText,
    permission: 'canRequestJobs'
  },
  { 
    title: 'Jobs', 
    url: '/jobs', 
    icon: Briefcase,
    permission: 'canViewJobs'
  },
  { 
    title: 'Members', 
    url: '/members', 
    icon: Users,
    permission: 'canViewMembers'
  },
  { 
    title: 'Invoices', 
    url: '/invoices', 
    icon: Receipt,
    permission: 'isPlatformAdmin'
  },
  { 
    title: 'Settings', 
    url: '/settings', 
    icon: SettingsIcon,
    permission: null // Always visible
  },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const location = useLocation()
  const permissions = usePermissions()
  const currentPath = location.pathname

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return currentPath === '/' || currentPath === '/dashboard'
    }
    return currentPath.startsWith(path)
  }

  const hasPermission = (permission: string | null) => {
    if (!permission) return true
    return permissions[permission as keyof typeof permissions]
  }

  const visibleItems = platformItems.filter(item => hasPermission(item.permission))

  return (
    <Sidebar className="border-r border-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-sm font-semibold">
            <ChevronRight className="h-4 w-4" />
            Platform
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.url)
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink 
                        to={item.url}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          active 
                            ? "bg-primary text-primary-foreground" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {state === "expanded" && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
