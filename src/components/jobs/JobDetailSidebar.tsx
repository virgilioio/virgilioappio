
import { cn } from '@/lib/utils'
import { FileText, Users, UserCheck } from 'lucide-react'

interface JobDetailSidebarProps {
  currentTab: string
  onTabChange: (tab: string) => void
  jobTitle: string
  canViewAssignments?: boolean
}

export function JobDetailSidebar({ 
  currentTab, 
  onTabChange, 
  jobTitle,
  canViewAssignments = false 
}: JobDetailSidebarProps) {
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: FileText,
      description: 'Job details and information'
    },
    {
      id: 'candidates',
      label: 'Candidates',
      icon: Users,
      description: 'Manage job candidates'
    }
  ]

  // Add assignments tab only if user has permission
  if (canViewAssignments) {
    tabs.push({
      id: 'assignments',
      label: 'Assignments',
      icon: UserCheck,
      description: 'Manage user job access'
    })
  }

  return (
    <div className="space-y-1">
      <div className="px-2 py-1 mb-2">
        <h3 className="font-medium text-text-primary text-sm truncate" title={jobTitle}>
          {jobTitle}
        </h3>
      </div>
      
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = currentTab === tab.id
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "w-full flex items-start gap-3 p-3 rounded-md text-left transition-colors",
              "hover:bg-surface-secondary/50",
              isActive 
                ? "bg-accent text-accent-foreground shadow-sm" 
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <Icon className={cn(
              "h-4 w-4 mt-0.5 shrink-0",
              isActive ? "text-accent-foreground" : "text-text-secondary"
            )} />
            <div className="min-w-0 flex-1">
              <div className={cn(
                "font-medium text-sm",
                isActive ? "text-accent-foreground" : "text-text-primary"
              )}>
                {tab.label}
              </div>
              <div className={cn(
                "text-xs mt-0.5 leading-tight",
                isActive ? "text-accent-foreground/80" : "text-text-secondary"
              )}>
                {tab.description}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
