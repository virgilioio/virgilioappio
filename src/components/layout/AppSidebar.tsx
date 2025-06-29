
import { Home } from "lucide-react"
import { NavLink } from "react-router-dom"
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
} from "@/components/ui/sidebar"

const items = [
  { title: "Home", url: "/", icon: Home },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar 
      className="border-r"
      style={{ backgroundColor: '#0d0d09' }}
    >
      <SidebarContent style={{ backgroundColor: '#0d0d09' }}>
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/80 px-4 py-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="text-white hover:bg-white/10 data-[active=true]:bg-white/20">
                    <NavLink 
                      to={item.url} 
                      end
                      className={({ isActive }) => 
                        `flex items-center gap-3 px-4 py-2 rounded-md transition-colors ${
                          isActive 
                            ? 'bg-white/20 text-white font-medium' 
                            : 'text-white/80 hover:text-white hover:bg-white/10'
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
