import { useState, useMemo } from 'react'
import { Plus, FileSearch, Clock, PanelLeftClose, PanelLeftOpen, Search, Globe, Lock, ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDistanceToNow } from 'date-fns'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useSourcingProjects } from '@/hooks/useSourcingProjects'
import { EditableSearchCriteria } from './EditableSearchCriteria'
import { SourcingProject, SourcingProjectFilters, SearchCriteria } from '@/types/sourcing'

interface SourcingSidebarProps {
  selectedProjectId: string | null
  onSelectProject: (id: string) => void
  onNewSearch: () => void
  // Filter props (only available when a project is selected)
  project?: SourcingProject | null
  filters?: SourcingProjectFilters
  onFiltersChange?: (filters: SourcingProjectFilters) => void
  onUpdateSearchCriteria?: (criteria: SearchCriteria) => Promise<void>
  isRefreshing?: boolean
}

export function SourcingSidebar({ 
  selectedProjectId, 
  onSelectProject, 
  onNewSearch,
  project,
  filters,
  onFiltersChange,
  onUpdateSearchCriteria,
  isRefreshing = false
}: SourcingSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [savedSearchesOpen, setSavedSearchesOpen] = useState(true)
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === 'collapsed'
  
  // Editing state for search criteria
  const [isEditingCriteria, setIsEditingCriteria] = useState(false)
  const [editableCriteria, setEditableCriteria] = useState<SearchCriteria | null>(null)
  
  const { data: projects, isLoading, error } = useSourcingProjects()
  
  // Filter projects based on search and status
  const filteredProjects = useMemo(() => {
    return projects?.filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter
      return matchesSearch && matchesStatus
    }) || []
  }, [projects, searchQuery, statusFilter])

  // Search criteria edit handlers
  const handleStartEdit = () => {
    if (project) {
      setEditableCriteria(project.search_criteria)
      setIsEditingCriteria(true)
    }
  }

  const handleSaveAndRefresh = async () => {
    if (!editableCriteria || !onUpdateSearchCriteria) return
    if (!editableCriteria.title_keywords || editableCriteria.title_keywords.length === 0) return
    setIsEditingCriteria(false)
    await onUpdateSearchCriteria(editableCriteria)
  }

  const handleCancelEdit = () => {
    if (project) {
      setEditableCriteria(project.search_criteria)
    }
    setIsEditingCriteria(false)
  }

  const isSaveDisabled = isRefreshing || !editableCriteria?.title_keywords || editableCriteria.title_keywords.length === 0
  
  return (
    <Sidebar 
      collapsible="icon"
      className={`shadow-calendly border-r border-virgilio-border/50 transition-all duration-300 top-12 sm:top-14 h-[calc(100vh-3rem)] sm:h-[calc(100vh-3.5rem)] bg-white ${isCollapsed ? 'w-14' : 'w-72'}`}
    >
      <SidebarHeader className="border-b border-virgilio-border/50 p-4 bg-gradient-to-b from-virgilio-purple/5 to-transparent">
        {!isCollapsed && (
          <>
            <Button 
              variant="default" 
              size="default" 
              className="w-full justify-center bg-virgilio-purple hover:bg-virgilio-purple/90 text-white font-semibold shadow-button mb-3 rounded-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
              onClick={onNewSearch}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Search
            </Button>
          </>
        )}
      </SidebarHeader>
      
      <SidebarContent className="overflow-y-auto">
        {!isCollapsed && (
          <div className="flex flex-col">
            {/* Saved Searches Section */}
            <Collapsible open={savedSearchesOpen} onOpenChange={setSavedSearchesOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors">
                <span className="text-xs font-semibold text-virgilio-muted uppercase tracking-wider">Saved Searches</span>
                {savedSearchesOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-virgilio-muted" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-virgilio-muted" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-3 space-y-2">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-virgilio-muted" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-8 pl-9 pr-3 rounded-lg border border-virgilio-border bg-white text-xs text-virgilio-text placeholder:text-virgilio-muted focus:outline-none focus:ring-2 focus:ring-virgilio-purple/30 focus:border-virgilio-purple transition-all duration-200"
                    />
                  </div>
                  
                  {/* Status Filter Tabs */}
                  <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'active' | 'archived' | 'all')}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="active" className="text-xs">Active</TabsTrigger>
                      <TabsTrigger value="archived" className="text-xs">Archived</TabsTrigger>
                      <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* Project List */}
                  {isLoading && (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-14 w-full rounded-lg" />
                      ))}
                    </div>
                  )}
                  
                  {error && (
                    <div className="p-3 text-xs text-destructive bg-destructive/10 rounded-lg">
                      Failed to load projects
                    </div>
                  )}
                  
                  {!isLoading && !error && filteredProjects.length === 0 && (
                    <div className="p-4 text-center bg-virgilio-purple/5 rounded-lg">
                      <FileSearch className="h-10 w-10 mx-auto text-virgilio-muted mb-2" />
                      <p className="text-xs font-medium text-virgilio-text">
                        {searchQuery ? 'No matching projects' : 'No projects yet'}
                      </p>
                    </div>
                  )}
                  
                  {!isLoading && filteredProjects.length > 0 && (
                    <div className="space-y-1">
                      {filteredProjects.map(proj => (
                        <button
                          key={proj.id}
                          onClick={() => onSelectProject(proj.id)}
                          className={`w-full px-3 py-2.5 rounded-lg border transition-all duration-200 text-left ${
                            selectedProjectId === proj.id
                              ? 'bg-virgilio-purple/10 border-virgilio-purple/30 text-virgilio-text'
                              : 'bg-white border-transparent hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <span className={`text-xs font-medium truncate ${selectedProjectId === proj.id ? 'text-virgilio-purple' : ''}`}>
                                {proj.name}
                              </span>
                              {proj.is_public ? (
                                <Globe className="h-3 w-3 flex-shrink-0 text-virgilio-muted" />
                              ) : (
                                <Lock className="h-3 w-3 flex-shrink-0 text-virgilio-muted opacity-60" />
                              )}
                            </div>
                            {proj.total_candidates > 0 && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 flex-shrink-0">
                                {proj.total_candidates}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-virgilio-muted mt-1">
                            <Clock className="h-2.5 w-2.5" />
                            <span>{formatDistanceToNow(new Date(proj.updated_at))} ago</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Search Criteria & Result Filters Section - only when project selected */}
            {project && filters && onFiltersChange && (
              <>
                <Separator />
                
                {/* Search Criteria */}
                <div className="px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-virgilio-muted uppercase tracking-wider">Search Criteria</span>
                    {!isEditingCriteria ? (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={handleStartEdit}
                        className="h-6 px-2 text-[10px] rounded-md hover:bg-virgilio-purple/10"
                      >
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleCancelEdit} 
                          className="h-6 px-2 text-[10px] rounded-md"
                        >
                          Cancel
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleSaveAndRefresh} 
                          disabled={isSaveDisabled}
                          className="h-6 px-2 text-[10px] rounded-md text-white bg-virgilio-purple hover:bg-virgilio-purple/90"
                        >
                          {isRefreshing ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              Refreshing
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Save & Refresh
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  {isEditingCriteria && editableCriteria ? (
                    <EditableSearchCriteria 
                      criteria={editableCriteria} 
                      onChange={setEditableCriteria} 
                    />
                  ) : (
                    <div className="space-y-2.5">
                      {project.search_criteria.title_keywords && project.search_criteria.title_keywords.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-medium text-virgilio-muted">Job Titles</span>
                          <div className="flex flex-wrap gap-1">
                            {project.search_criteria.title_keywords.map(title => (
                              <Badge key={title} variant="pastel-purple" className="text-[10px] h-5">{title}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {project.search_criteria.keywords && (Array.isArray(project.search_criteria.keywords) ? project.search_criteria.keywords.length > 0 : true) && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-medium text-virgilio-muted">Keywords</span>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(project.search_criteria.keywords) 
                              ? project.search_criteria.keywords.map(kw => (
                                  <Badge key={kw} variant="keyword-match" className="text-[10px] h-5">{kw}</Badge>
                                ))
                              : <Badge variant="keyword-match" className="text-[10px] h-5">{project.search_criteria.keywords}</Badge>
                            }
                          </div>
                        </div>
                      )}
                      {project.search_criteria.locations && project.search_criteria.locations.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-medium text-virgilio-muted">Locations</span>
                          <div className="flex flex-wrap gap-1">
                            {project.search_criteria.locations.map(loc => (
                              <Badge key={loc} variant="pastel-blue" className="text-[10px] h-5">{loc}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {project.search_criteria.seniorities && project.search_criteria.seniorities.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-medium text-virgilio-muted">Seniority</span>
                          <div className="flex flex-wrap gap-1">
                            {project.search_criteria.seniorities.map(level => (
                              <Badge key={level} variant="category" className="text-[10px] h-5 capitalize">{level.replace('_', ' ')}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {project.search_criteria.company_sizes && project.search_criteria.company_sizes.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-medium text-virgilio-muted">Company Size</span>
                          <div className="flex flex-wrap gap-1">
                            {project.search_criteria.company_sizes.map(size => (
                              <Badge key={size} variant="category" className="text-[10px] h-5">{size}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {project.search_criteria.company_domains && project.search_criteria.company_domains.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-medium text-virgilio-muted">Company Domains</span>
                          <div className="flex flex-wrap gap-1">
                            {project.search_criteria.company_domains.map(domain => (
                              <Badge key={domain} variant="category" className="text-[10px] h-5">{domain}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {project.search_criteria.company_names && project.search_criteria.company_names.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-medium text-virgilio-muted">Target Companies</span>
                          <div className="flex flex-wrap gap-1">
                            {project.search_criteria.company_names.map(name => (
                              <Badge key={name} variant="pastel-orange" className="text-[10px] h-5">{name}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {project.search_criteria.experience_years && (project.search_criteria.experience_years.min || project.search_criteria.experience_years.max) && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-medium text-virgilio-muted">Experience</span>
                          <Badge variant="category" className="text-[10px] h-5">
                            {project.search_criteria.experience_years.min || 0} - {project.search_criteria.experience_years.max || 30} years
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Result Filters */}
                <div className="px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-virgilio-muted uppercase tracking-wider">Result Filters</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onFiltersChange({
                        matchTiers: [],
                        minExperience: 0,
                        maxExperience: 30,
                        source: 'all',
                        hasEmail: undefined,
                        hasPhone: undefined
                      })}
                      className="h-6 px-2 text-[10px] rounded-md hover:bg-virgilio-purple/10"
                    >
                      Reset
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-medium text-virgilio-muted">Contact Info</Label>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <Checkbox 
                          checked={filters.hasEmail === true}
                          onCheckedChange={(checked) => {
                            onFiltersChange({
                              ...filters,
                              hasEmail: checked ? true : undefined
                            })
                          }}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-xs text-virgilio-text group-hover:text-virgilio-purple transition-colors">Has Email</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <Checkbox 
                          checked={filters.hasPhone === true}
                          onCheckedChange={(checked) => {
                            onFiltersChange({
                              ...filters,
                              hasPhone: checked ? true : undefined
                            })
                          }}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-xs text-virgilio-text group-hover:text-virgilio-purple transition-colors">Has Phone</span>
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SidebarContent>
      
      <SidebarFooter className="border-t border-virgilio-border/50 p-3 bg-white">
        {!isCollapsed ? (
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full justify-center border-virgilio-border text-virgilio-text text-xs hover:bg-virgilio-purple/5 hover:border-virgilio-purple/50 rounded-lg transition-all duration-200"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-3.5 w-3.5 mr-1.5" />
            Collapse
          </Button>
        ) : (
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full h-8 p-0 border-virgilio-border text-virgilio-text hover:bg-virgilio-purple/5 hover:border-virgilio-purple/50 rounded-lg transition-all duration-200"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-3.5 w-3.5" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}