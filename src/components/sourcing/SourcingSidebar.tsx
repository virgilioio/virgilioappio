import { useState, useMemo } from 'react'
import { Plus, FileSearch, Clock, PanelLeftClose, PanelLeftOpen, Search, Globe, Lock } from 'lucide-react'
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
      className={`shadow-calendly border-r border-virgilio-border/50 transition-all duration-300 top-12 sm:top-14 h-[calc(100vh-3rem)] sm:h-[calc(100vh-3.5rem)] bg-white ${isCollapsed ? 'w-14' : 'w-64'}`}
    >
      <SidebarHeader className="border-b border-virgilio-border/50 p-6 bg-gradient-to-b from-virgilio-purple/5 to-transparent">
        {!isCollapsed && (
          <h2 className="text-h4-mobile font-poppins font-bold text-virgilio-text mb-5">
            Sourcing Projects<span className="text-virgilio-purple">.</span>
          </h2>
        )}
        
        {!isCollapsed && (
          <>
            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-virgilio-muted" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-virgilio-border bg-white text-sm text-virgilio-text placeholder:text-virgilio-muted focus:outline-none focus:ring-2 focus:ring-virgilio-purple/30 focus:border-virgilio-purple transition-all duration-200"
              />
            </div>
            
            {/* New Search Button */}
            <Button 
              variant="default" 
              size="default" 
              className="w-full justify-center bg-virgilio-purple hover:bg-virgilio-purple/90 text-white font-semibold shadow-button mb-4 rounded-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
              onClick={onNewSearch}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Search
            </Button>
            
            {/* Status Filter Pills */}
            <div className="flex gap-1.5 p-1 bg-virgilio-purple/5 rounded-lg">
              <button 
                onClick={() => setStatusFilter('active')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  statusFilter === 'active' 
                    ? 'bg-white text-virgilio-purple shadow-sm' 
                    : 'text-virgilio-muted hover:text-virgilio-text'
                }`}
              >
                Active
              </button>
              <button 
                onClick={() => setStatusFilter('archived')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  statusFilter === 'archived' 
                    ? 'bg-white text-virgilio-purple shadow-sm' 
                    : 'text-virgilio-muted hover:text-virgilio-text'
                }`}
              >
                Archived
              </button>
              <button 
                onClick={() => setStatusFilter('all')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  statusFilter === 'all' 
                    ? 'bg-white text-virgilio-purple shadow-sm' 
                    : 'text-virgilio-muted hover:text-virgilio-text'
                }`}
              >
                All
              </button>
            </div>
          </>
        )}
      </SidebarHeader>
      
      <SidebarContent className="px-4 py-4">
        {!isCollapsed && (
          <>
            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg shadow-calendly" />
                ))}
              </div>
            )}
            
            {error && (
              <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
                Failed to load projects
              </div>
            )}
            
            {!isLoading && !error && filteredProjects.length === 0 && (
              <div className="p-6 text-center bg-virgilio-purple/5 rounded-lg">
                <FileSearch className="h-16 w-16 mx-auto text-virgilio-muted mb-3" />
                <p className="text-sm font-medium text-virgilio-text">
                  {searchQuery ? 'No matching projects' : 'No projects yet'}
                </p>
                <p className="text-xs text-virgilio-muted mt-1.5">
                  Start by creating a search!
                </p>
              </div>
            )}
            
            {!isLoading && filteredProjects.length > 0 && (
              <div className="space-y-2">
                {filteredProjects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                    className={`w-full p-4 rounded-lg border transition-all duration-200 text-left ${
                      selectedProjectId === project.id
                        ? 'bg-gradient-to-br from-virgilio-purple to-virgilio-purple/90 text-white border-virgilio-purple shadow-calendly scale-[1.02]'
                        : 'bg-white border-virgilio-border/50 hover:border-virgilio-purple/30 hover:shadow-calendly hover:-translate-y-0.5 active:translate-y-0'
                    }`}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-semibold text-sm truncate">
                            {project.name}
                          </span>
                          {project.is_public ? (
                            <span title="Visible to organization">
                              <Globe className="h-3 w-3 flex-shrink-0" />
                            </span>
                          ) : (
                            <span title="Private">
                              <Lock className="h-3 w-3 flex-shrink-0 opacity-60" />
                            </span>
                          )}
                        </div>
                        {project.total_candidates > 0 && (
                          <Badge 
                            variant="secondary" 
                            className={`text-xs h-5 px-2 flex-shrink-0 ${
                              selectedProjectId === project.id 
                                ? 'bg-white/20 text-white border-white/30' 
                                : 'bg-virgilio-purple/10 text-virgilio-purple border-virgilio-purple/20'
                            }`}
                          >
                            {project.total_candidates}
                          </Badge>
                        )}
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs ${
                        selectedProjectId === project.id ? 'text-white/80' : 'text-virgilio-muted'
                      }`}>
                        <Clock className="h-3 w-3" />
                        <span>{formatDistanceToNow(new Date(project.updated_at))} ago</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </SidebarContent>
      
      <SidebarFooter className="border-t border-virgilio-border/50 p-4 bg-white">
        {!isCollapsed ? (
          <Button 
            size="default" 
            variant="outline" 
            className="w-full justify-center border-virgilio-border text-virgilio-text font-medium hover:bg-virgilio-purple/5 hover:border-virgilio-purple/50 rounded-lg transition-all duration-200 hover:shadow-sm"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4 mr-2 transition-transform duration-200" />
            Collapse
          </Button>
        ) : (
          <Button 
            size="default" 
            variant="outline" 
            className="w-full h-10 p-0 border-virgilio-border text-virgilio-text hover:bg-virgilio-purple/5 hover:border-virgilio-purple/50 rounded-lg transition-all duration-200 hover:shadow-sm"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4 transition-transform duration-200" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
