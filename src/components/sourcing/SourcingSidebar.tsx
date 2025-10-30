import { useState, useMemo } from 'react'
import { Plus, FileSearch, Clock, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInput,
  SidebarTrigger,
  useSidebar
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useSourcingProjects } from '@/hooks/useSourcingProjects'

interface SourcingSidebarProps {
  selectedProjectId: string | null
  onSelectProject: (id: string) => void
  onNewSearch: () => void
}

export function SourcingSidebar({ 
  selectedProjectId, 
  onSelectProject, 
  onNewSearch 
}: SourcingSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active')
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === 'collapsed'
  
  const { data: projects, isLoading, error } = useSourcingProjects()
  
  // Filter projects based on search and status
  const filteredProjects = useMemo(() => {
    return projects?.filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter
      return matchesSearch && matchesStatus
    }) || []
  }, [projects, searchQuery, statusFilter])
  
  return (
    <Sidebar 
      collapsible="icon"
      className={`shadow-calendly border-r border-virgilio-border transition-all duration-300 top-12 sm:top-14 h-[calc(100vh-3rem)] sm:h-[calc(100vh-3.5rem)] bg-white ${isCollapsed ? 'w-14' : 'w-64'}`}
    >
      <SidebarHeader className="border-b border-virgilio-border p-6">
        {!isCollapsed && (
          <h2 className="text-h4-mobile font-poppins font-bold text-virgilio-text mb-4">
            Sourcing Projects<span className="text-virgilio-purple">.</span>
          </h2>
        )}
        
        {!isCollapsed && (
          <>
            {/* Search Input */}
            <SidebarInput 
              placeholder="Search projects..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2"
            />
            
            {/* New Search Button */}
            <Button 
              variant="default" 
              size="default" 
              className="w-full justify-center bg-virgilio-purple hover:bg-virgilio-purple/90 text-white font-semibold shadow-button mb-3 rounded-lg transition-all duration-200 hover:-translate-y-0.5"
              onClick={onNewSearch}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Search
            </Button>
            
            {/* Status Filter Toggle */}
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant={statusFilter === 'active' ? 'secondary' : 'outline'}
                onClick={() => setStatusFilter('active')}
                className={`flex-1 text-sm font-medium h-8 rounded-lg transition-all duration-200 ${
                  statusFilter === 'active' 
                    ? 'bg-virgilio-purple/10 text-virgilio-purple border-virgilio-purple/30' 
                    : 'border-virgilio-border text-virgilio-muted hover:border-virgilio-purple/50 hover:bg-virgilio-purple/5'
                }`}
              >
                Active
              </Button>
              <Button 
                size="sm" 
                variant={statusFilter === 'archived' ? 'secondary' : 'outline'}
                onClick={() => setStatusFilter('archived')}
                className={`flex-1 text-sm font-medium h-8 rounded-lg transition-all duration-200 ${
                  statusFilter === 'archived' 
                    ? 'bg-virgilio-purple/10 text-virgilio-purple border-virgilio-purple/30' 
                    : 'border-virgilio-border text-virgilio-muted hover:border-virgilio-purple/50 hover:bg-virgilio-purple/5'
                }`}
              >
                Archived
              </Button>
              <Button 
                size="sm" 
                variant={statusFilter === 'all' ? 'secondary' : 'outline'}
                onClick={() => setStatusFilter('all')}
                className={`flex-1 text-sm font-medium h-8 rounded-lg transition-all duration-200 ${
                  statusFilter === 'all' 
                    ? 'bg-virgilio-purple/10 text-virgilio-purple border-virgilio-purple/30' 
                    : 'border-virgilio-border text-virgilio-muted hover:border-virgilio-purple/50 hover:bg-virgilio-purple/5'
                }`}
              >
                All
              </Button>
            </div>
          </>
        )}
      </SidebarHeader>
      
      <SidebarContent className="px-4 py-4">
        {!isCollapsed && (
          <>
            {isLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )}
            
            {error && (
              <div className="p-4 text-sm text-destructive">
                Failed to load projects
              </div>
            )}
            
            {!isLoading && !error && filteredProjects.length === 0 && (
              <div className="p-4 text-center">
                <FileSearch className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'No matching projects' : 'No projects yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start by creating a search!
                </p>
              </div>
            )}
            
            {!isLoading && filteredProjects.length > 0 && (
              <SidebarMenu>
                {filteredProjects.map(project => (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton
                      onClick={() => onSelectProject(project.id)}
                      isActive={selectedProjectId === project.id}
                      className={`w-full h-auto py-3 px-4 rounded-lg transition-all duration-200 ${
                        selectedProjectId === project.id
                          ? 'bg-virgilio-purple text-white shadow-sm'
                          : 'hover:bg-virgilio-purple/5 hover:border-virgilio-purple/30'
                      }`}
                    >
                      <div className="flex flex-col items-start w-full gap-1">
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium text-sm truncate max-w-[180px]">
                            {project.name}
                          </span>
                          {project.total_candidates > 0 && (
                            <Badge variant="secondary" className="text-xs h-5">
                              {project.total_candidates}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatDistanceToNow(new Date(project.updated_at))} ago</span>
                        </div>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </>
        )}
      </SidebarContent>
      
      <SidebarFooter className="border-t border-virgilio-border p-4 bg-white">
        {!isCollapsed ? (
          <Button 
            size="default" 
            variant="outline" 
            className="w-full justify-center border-virgilio-border text-virgilio-text font-medium hover:bg-virgilio-purple/5 hover:border-virgilio-purple/50 rounded-lg transition-all duration-200"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4 mr-2" />
            Collapse
          </Button>
        ) : (
          <Button 
            size="default" 
            variant="outline" 
            className="w-full h-10 p-0 border-virgilio-border text-virgilio-text hover:bg-virgilio-purple/5 hover:border-virgilio-purple/50 rounded-lg transition-all duration-200"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
