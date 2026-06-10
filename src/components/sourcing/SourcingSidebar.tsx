import { useState, useMemo, useEffect } from 'react'
import { Plus, FileSearch, Clock, PanelLeftClose, PanelLeftOpen, Search, Globe, Lock, ChevronDown, ChevronRight, Loader2, RefreshCw, X } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FilterCheckboxGroup } from '@/components/ui/filter-checkbox-group'
import { useSourcingProjects } from '@/hooks/useSourcingProjects'
import { LocationSelector } from './LocationSelector'
import { SourcingProject, SourcingProjectFilters, SearchCriteria } from '@/types/sourcing'
import { InlineEmpty } from '@/components/ui/empty-state'

// Apollo seniority options
const SENIORITY_OPTIONS = [
  { value: 'intern', label: 'Intern' },
  { value: 'entry', label: 'Entry Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'manager', label: 'Manager' },
  { value: 'director', label: 'Director' },
  { value: 'head', label: 'Head' },
  { value: 'vp', label: 'VP' },
  { value: 'c_suite', label: 'C-Suite' },
  { value: 'partner', label: 'Partner' },
  { value: 'owner', label: 'Owner' },
  { value: 'founder', label: 'Founder' },
]

// Apollo company size options
const COMPANY_SIZE_OPTIONS = [
  { value: '1,10', label: '1-10' },
  { value: '11,50', label: '11-50' },
  { value: '51,200', label: '51-200' },
  { value: '201,500', label: '201-500' },
  { value: '501,1000', label: '501-1K' },
  { value: '1001,5000', label: '1K-5K' },
  { value: '5001,10000', label: '5K-10K' },
  { value: '10001,', label: '10K+' },
]

// Apollo industry options
const INDUSTRY_OPTIONS = [
  { value: 'information technology & services', label: 'IT & Services' },
  { value: 'computer software', label: 'Software' },
  { value: 'internet', label: 'Internet' },
  { value: 'financial services', label: 'Financial Services' },
  { value: 'banking', label: 'Banking' },
  { value: 'marketing and advertising', label: 'Marketing & Ads' },
  { value: 'management consulting', label: 'Consulting' },
  { value: 'hospital & health care', label: 'Healthcare' },
  { value: 'pharmaceuticals', label: 'Pharma' },
  { value: 'real estate', label: 'Real Estate' },
  { value: 'retail', label: 'Retail' },
  { value: 'e-commerce', label: 'E-commerce' },
  { value: 'education management', label: 'Education' },
  { value: 'telecommunications', label: 'Telecom' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'food & beverages', label: 'Food & Bev' },
  { value: 'construction', label: 'Construction' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'staffing and recruiting', label: 'Staffing' },
  { value: 'logistics and supply chain', label: 'Logistics' },
  { value: 'nonprofit organization management', label: 'Non-Profit' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'legal services', label: 'Legal' },
  { value: 'oil & energy', label: 'Oil & Energy' },
  { value: 'consumer goods', label: 'Consumer Goods' },
  { value: 'media', label: 'Media' },
]

interface SourcingSidebarProps {
  selectedProjectId: string | null
  onSelectProject: (id: string) => void
  onNewSearch: () => void
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
  
  // Local editable criteria state
  const [editableCriteria, setEditableCriteria] = useState<SearchCriteria | null>(null)
  const [newTitleKeyword, setNewTitleKeyword] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  
  const { data: projects, isLoading, error } = useSourcingProjects()

  // Sync editable criteria when project changes
  useEffect(() => {
    if (project?.search_criteria) {
      setEditableCriteria(project.search_criteria)
      setHasChanges(false)
    }
  }, [project?.id, project?.search_criteria])

  const updateCriteria = (updates: Partial<SearchCriteria>) => {
    if (!editableCriteria) return
    setEditableCriteria({ ...editableCriteria, ...updates })
    setHasChanges(true)
  }
  
  // Filter projects based on search and status
  const filteredProjects = useMemo(() => {
    return projects?.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      return matchesSearch && matchesStatus
    }) || []
  }, [projects, searchQuery, statusFilter])

  const handleSaveAndRefresh = async () => {
    if (!editableCriteria || !onUpdateSearchCriteria) return
    if (!editableCriteria.title_keywords || editableCriteria.title_keywords.length === 0) return
    await onUpdateSearchCriteria(editableCriteria)
    setHasChanges(false)
  }

  const handleAddTitleKeyword = () => {
    if (!newTitleKeyword.trim() || !editableCriteria) return
    const current = editableCriteria.title_keywords || []
    if (!current.includes(newTitleKeyword.trim())) {
      updateCriteria({ title_keywords: [...current, newTitleKeyword.trim()] })
      setNewTitleKeyword('')
    }
  }

  const handleAddKeyword = () => {
    if (!newKeyword.trim() || !editableCriteria) return
    const current = editableCriteria.keywords || []
    if (!current.includes(newKeyword.trim())) {
      updateCriteria({ keywords: [...current, newKeyword.trim()] })
      setNewKeyword('')
    }
  }

  const handleAddCompanyName = () => {
    if (!newCompanyName.trim() || !editableCriteria) return
    const current = editableCriteria.company_names || []
    if (!current.includes(newCompanyName.trim())) {
      updateCriteria({ company_names: [...current, newCompanyName.trim()] })
      setNewCompanyName('')
    }
  }

  const isSaveDisabled = isRefreshing || !hasChanges || !editableCriteria?.title_keywords || editableCriteria.title_keywords.length === 0
  
  return (
    <Sidebar 
      collapsible="icon"
      className={`shadow-calendly border-r border-virgilio-border/50 transition-all duration-300 top-12 sm:top-14 h-[calc(100vh-3rem)] sm:h-[calc(100vh-3.5rem)] bg-white ${isCollapsed ? 'w-14' : 'w-72'}`}
    >
      <SidebarHeader className="border-b border-virgilio-border/50 p-4 bg-gradient-to-b from-virgilio-purple/5 to-transparent">
        {!isCollapsed && (
          <Button 
            variant="default" 
            size="default" 
            className="w-full justify-center bg-virgilio-purple hover:bg-virgilio-purple/90 text-white font-semibold shadow-button mb-3 rounded-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            onClick={onNewSearch}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Search
          </Button>
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
                    <InlineEmpty text={searchQuery ? 'No matching projects' : 'No projects yet'} />
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

            {/* Search Criteria & Result Filters — only when project selected */}
            {project && editableCriteria && filters && onFiltersChange && (
              <>
                <Separator />
                
                {/* Search Criteria — always editable */}
                <div className="px-4 py-3 space-y-4">
                  <span className="text-xs font-semibold text-virgilio-muted uppercase tracking-wider">Search Criteria</span>

                  {/* Job Titles */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Job Titles</span>
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="Add title..."
                        value={newTitleKeyword}
                        onChange={(e) => setNewTitleKeyword(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTitleKeyword() } }}
                        className="h-7 text-xs flex-1"
                      />
                      <Button size="sm" variant="ghost" onClick={handleAddTitleKeyword} className="h-7 w-7 p-0 hover:bg-virgilio-purple/10">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {editableCriteria.title_keywords && editableCriteria.title_keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {editableCriteria.title_keywords.map(kw => (
                          <Badge key={kw} variant="pastel-purple" className="text-[10px] h-5 gap-0.5 pr-1">
                            {kw}
                            <button onClick={() => updateCriteria({ title_keywords: editableCriteria.title_keywords!.filter(k => k !== kw) })} className="hover:bg-destructive/10 rounded-sm">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Keywords */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Keywords</span>
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="Add keyword..."
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddKeyword() } }}
                        className="h-7 text-xs flex-1"
                      />
                      <Button size="sm" variant="ghost" onClick={handleAddKeyword} className="h-7 w-7 p-0 hover:bg-virgilio-purple/10">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {editableCriteria.keywords && editableCriteria.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {editableCriteria.keywords.map(kw => (
                          <Badge key={kw} variant="keyword-match" className="text-[10px] h-5 gap-0.5 pr-1">
                            {kw}
                            <button onClick={() => updateCriteria({ keywords: editableCriteria.keywords!.filter(k => k !== kw) })} className="hover:bg-destructive/10 rounded-sm">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Locations */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Locations</span>
                    <LocationSelector
                      selectedLocations={editableCriteria.locations || []}
                      onLocationsChange={(locations) => updateCriteria({ locations })}
                    />
                  </div>

                  {/* Seniority — FilterCheckboxGroup */}
                  <FilterCheckboxGroup
                    label="Seniority"
                    options={SENIORITY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                    selectedValues={editableCriteria.seniorities || []}
                    onToggle={(value) => {
                      const current = editableCriteria.seniorities || []
                      updateCriteria({
                        seniorities: current.includes(value) ? current.filter(v => v !== value) : [...current, value]
                      })
                    }}
                    onClear={() => updateCriteria({ seniorities: [] })}
                    maxVisible={6}
                  />

                  {/* Company Size — FilterCheckboxGroup */}
                  <FilterCheckboxGroup
                    label="Company Size"
                    options={COMPANY_SIZE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                    selectedValues={editableCriteria.company_sizes || []}
                    onToggle={(value) => {
                      const current = editableCriteria.company_sizes || []
                      updateCriteria({
                        company_sizes: current.includes(value) ? current.filter(v => v !== value) : [...current, value]
                      })
                    }}
                    onClear={() => updateCriteria({ company_sizes: [] })}
                    maxVisible={6}
                  />

                  {/* Industry — FilterCheckboxGroup (searchable) */}
                  <FilterCheckboxGroup
                    label="Industry"
                    options={INDUSTRY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                    selectedValues={editableCriteria.industries || []}
                    onToggle={(value) => {
                      const current = editableCriteria.industries || []
                      updateCriteria({
                        industries: current.includes(value) ? current.filter(v => v !== value) : [...current, value]
                      })
                    }}
                    onClear={() => updateCriteria({ industries: [] })}
                    searchable
                    searchThreshold={6}
                    maxVisible={6}
                  />

                  {/* Target Companies */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Target Companies</span>
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="Add company..."
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCompanyName() } }}
                        className="h-7 text-xs flex-1"
                      />
                      <Button size="sm" variant="ghost" onClick={handleAddCompanyName} className="h-7 w-7 p-0 hover:bg-virgilio-purple/10">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {editableCriteria.company_names && editableCriteria.company_names.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {editableCriteria.company_names.map(name => (
                          <Badge key={name} variant="pastel-orange" className="text-[10px] h-5 gap-0.5 pr-1">
                            {name}
                            <button onClick={() => updateCriteria({ company_names: editableCriteria.company_names!.filter(n => n !== name) })} className="hover:bg-destructive/10 rounded-sm">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Experience */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Experience (years)</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={editableCriteria.experience_years?.min ?? ''}
                        onChange={(e) => updateCriteria({
                          experience_years: {
                            ...editableCriteria.experience_years,
                            min: e.target.value ? parseInt(e.target.value) : undefined
                          }
                        })}
                        min={0} max={30}
                        className="h-7 text-xs w-16"
                      />
                      <span className="text-[10px] text-muted-foreground">to</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={editableCriteria.experience_years?.max ?? ''}
                        onChange={(e) => updateCriteria({
                          experience_years: {
                            ...editableCriteria.experience_years,
                            max: e.target.value ? parseInt(e.target.value) : undefined
                          }
                        })}
                        min={0} max={30}
                        className="h-7 text-xs w-16"
                      />
                    </div>
                  </div>

                  {/* Save & Refresh */}
                  <Button 
                    size="sm" 
                    onClick={handleSaveAndRefresh} 
                    disabled={isSaveDisabled}
                    className="w-full h-8 text-xs rounded-lg text-white bg-virgilio-purple hover:bg-virgilio-purple/90"
                  >
                    {isRefreshing ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1.5" />
                        Save & Refresh
                      </>
                    )}
                  </Button>
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
