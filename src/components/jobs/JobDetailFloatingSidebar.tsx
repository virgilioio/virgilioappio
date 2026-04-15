
import { cn } from '@/lib/utils'
import { LayoutDashboard, Settings, Kanban, Users, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface JobDetailFloatingSidebarProps {
  currentTab: string
  onTabChange: (tab: string) => void
  jobTitle: string
  isRestrictedViewer?: boolean
  sourcingProjectId?: string | null
  className?: string
}

export function JobDetailFloatingSidebar({ 
  currentTab, 
  onTabChange, 
  jobTitle,
  isRestrictedViewer = false,
  sourcingProjectId,
  className 
}: JobDetailFloatingSidebarProps) {
  const navigate = useNavigate()
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

        {sourcingProjectId && (
          <>
            <div className="w-6 border-t border-border my-3" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-12 h-12 aspect-square !rounded-full p-0 flex items-center justify-center border border-border text-muted-foreground hover:bg-transparent hover:text-inherit hover:scale-100 active:scale-100"
                    onClick={() => navigate(`/find/${sourcingProjectId}`)}
                    aria-label="Sourcing Project"
                  >
                    <Search className="h-5 w-5" />
                    <span className="sr-only">Sourcing Project</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Sourcing Project</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>
    </div>
  )
}
