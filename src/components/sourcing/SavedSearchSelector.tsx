import { useState, useMemo } from 'react'
import { Search, Plus, Clock, Globe, Lock, ChevronDown, FileSearch, Bookmark, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSourcingProjects } from '@/hooks/useSourcingProjects'
import { SourcingProject } from '@/types/sourcing'

interface SavedSearchSelectorProps {
  selectedProjectId: string | null
  currentProject: SourcingProject | null
  onSelectProject: (id: string) => void
  onNewSearch: () => void
}

export function SavedSearchSelector({
  selectedProjectId,
  currentProject,
  onSelectProject,
  onNewSearch,
}: SavedSearchSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active')
  const { data: projects, isLoading, error } = useSourcingProjects()

  const filteredProjects = useMemo(() => {
    return projects?.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      return matchesSearch && matchesStatus
    }) || []
  }, [projects, searchQuery, statusFilter])

  const triggerLabel = currentProject ? currentProject.name : 'Select a search...'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 h-8 text-sm font-poppins font-medium transition-all duration-150 whitespace-nowrap hover:bg-accent/30 ${
            currentProject
              ? 'bg-accent/40 border-accent-foreground/20 text-accent-foreground'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bookmark className="h-3.5 w-3.5" />
          {currentProject ? currentProject.name : 'Searches'}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0" sideOffset={8}>
        <div className="p-3 space-y-2 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search saved searches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-9 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all duration-200"
            />
          </div>
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'active' | 'archived' | 'all')}>
            <TabsList className="grid w-full grid-cols-3 h-7">
              <TabsTrigger value="active" className="text-xs h-6">Active</TabsTrigger>
              <TabsTrigger value="archived" className="text-xs h-6">Archived</TabsTrigger>
              <TabsTrigger value="all" className="text-xs h-6">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="max-h-64 overflow-y-auto p-2 space-y-0.5">
          {isLoading && (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          )}

          {error && (
            <div className="p-3 text-xs text-destructive bg-destructive/10 rounded-lg">
              Failed to load searches
            </div>
          )}

          {!isLoading && !error && filteredProjects.length === 0 && (
            <div className="p-4 text-center">
              <FileSearch className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">
                {searchQuery ? 'No matching searches' : 'No saved searches yet'}
              </p>
            </div>
          )}

          {!isLoading && filteredProjects.map(proj => (
            <button
              key={proj.id}
              onClick={() => { onSelectProject(proj.id); setOpen(false) }}
              className={`w-full px-3 py-2 rounded-lg border transition-all duration-200 text-left ${
                selectedProjectId === proj.id
                  ? 'bg-primary/10 border-primary/30'
                  : 'bg-background border-transparent hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className={`text-xs font-medium truncate ${selectedProjectId === proj.id ? 'text-primary' : 'text-foreground'}`}>
                    {proj.name}
                  </span>
                  {proj.is_public ? (
                    <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <Lock className="h-3 w-3 shrink-0 text-muted-foreground opacity-60" />
                  )}
                </div>
                {proj.total_candidates > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                    {proj.total_candidates}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                <Clock className="h-2.5 w-2.5" />
                <span>{formatDistanceToNow(new Date(proj.updated_at))} ago</span>
              </div>
            </button>
          ))}
        </div>

        <div className="p-2 border-t">
          <Button
            variant="default"
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => { onNewSearch(); setOpen(false) }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Search
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
