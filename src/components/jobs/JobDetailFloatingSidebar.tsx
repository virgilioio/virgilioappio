
import { cn } from '@/lib/utils'
import { LayoutDashboard, Settings, Kanban, Users, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { JobSourcingProjectSummary } from '@/hooks/useJobSourcingProject'

interface JobDetailFloatingSidebarProps {
  currentTab: string
  onTabChange: (tab: string) => void
  jobTitle: string
  isRestrictedViewer?: boolean
  sourcingProjects?: JobSourcingProjectSummary[]
  className?: string
}

export function JobDetailFloatingSidebar({ 
  currentTab, 
  onTabChange, 
  jobTitle,
  isRestrictedViewer = false,
  sourcingProjects = [],
  className 
}: JobDetailFloatingSidebarProps) {
  const navigate = useNavigate()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const restrictedTabIds = ['all-candidates', 'job-setup']
  const allTabs = [
    {
      id: 'candidates',
      label: 'Job Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'all-candidates',
      label: 'All Candidates',
      icon: Users,
    },
    {
      id: 'pipeline',
      label: 'Pipeline Overview',
      icon: Kanban,
    },
    {
      id: 'job-setup',
      label: 'Job Setup',
      icon: Settings,
    }
  ]

  const tabs = allTabs
    .filter(tab => !isRestrictedViewer || !restrictedTabIds.includes(tab.id))

  const hasMultiple = sourcingProjects.length > 1
  const hasAny = sourcingProjects.length > 0
  const singleProject = sourcingProjects[0]

  const sourcingButton = (
    <Button
      variant="ghost"
      size="icon"
      className="relative w-12 h-12 aspect-square !rounded-full p-0 flex items-center justify-center border border-border text-muted-foreground hover:bg-transparent hover:text-inherit hover:scale-100 active:scale-100"
      onClick={() => {
        if (hasMultiple) {
          setPopoverOpen((o) => !o)
        } else if (singleProject) {
          navigate(`/find/${singleProject.id}`)
        }
      }}
      aria-label="Sourcing Project"
    >
      <Search className="h-5 w-5" />
      {hasMultiple && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-foreground text-background text-[10px] font-medium flex items-center justify-center leading-none">
          {sourcingProjects.length}
        </span>
      )}
      <span className="sr-only">Sourcing Project</span>
    </Button>
  )

  return (
    <div className={cn("w-20 flex-shrink-0 p-2 flex justify-center", className)}>
      <div className="bg-card border border-border rounded-full shadow-lg h-fit py-6 px-3 flex flex-col items-center">
        <nav className="space-y-3">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = currentTab === tab.id
            
            return (
              <Button
                key={tab.id}
                variant="ghost"
                size="icon"
                className={cn(
                  "w-12 h-12 aspect-square !rounded-full p-0 flex items-center justify-center",
                  isActive
                    ? "bg-foreground text-background hover:bg-foreground hover:text-background hover:scale-100 active:scale-100"
                    : "border border-border text-muted-foreground hover:bg-transparent hover:text-inherit hover:scale-100 active:scale-100"
                )}
                onClick={() => onTabChange(tab.id)}
                aria-label={tab.label}
                title={tab.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{tab.label}</span>
              </Button>
            )
          })}
        </nav>

        {hasAny && (
          <>
            <div className="w-6 border-t border-border my-3" />
            {hasMultiple ? (
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>{sourcingButton}</PopoverTrigger>
                <PopoverContent side="right" align="start" className="w-72 p-2">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Sourcing Projects ({sourcingProjects.length})
                  </div>
                  <div className="flex flex-col">
                    {sourcingProjects.map((proj) => {
                      const updatedLabel = proj.updated_at
                        ? `Updated ${formatDistanceToNow(new Date(proj.updated_at), { addSuffix: true })}`
                        : null
                      return (
                        <button
                          key={proj.id}
                          onClick={() => {
                            setPopoverOpen(false)
                            navigate(`/find/${proj.id}`)
                          }}
                          className="text-left px-2 py-2 rounded-md hover:bg-accent transition-colors"
                        >
                          <div className="text-sm font-medium text-foreground truncate">
                            {proj.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {proj.total_candidates ?? 0} candidates
                            {updatedLabel ? ` · ${updatedLabel}` : ''}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>{sourcingButton}</TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{singleProject?.name ?? 'Sourcing Project'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        )}
      </div>
    </div>
  )
}
