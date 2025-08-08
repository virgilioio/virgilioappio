
import { cn } from '@/lib/utils'
import { Users, Settings, Kanban } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface JobDetailFloatingSidebarProps {
  currentTab: string
  onTabChange: (tab: string) => void
  jobTitle: string
  className?: string
}

export function JobDetailFloatingSidebar({ 
  currentTab, 
  onTabChange, 
  jobTitle,
  className 
}: JobDetailFloatingSidebarProps) {
  const tabs = [
    {
      id: 'candidates',
      label: 'Application Review',
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

  return (
    <div className={cn("w-40 flex-shrink-0 p-4 flex justify-center", className)}>
      <div className="bg-card border border-border rounded-full shadow-lg h-fit py-6 px-3 flex flex-col items-center">
        <nav className="space-y-3">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = currentTab === tab.id
            
            return (
              <Button
                key={tab.id}
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-12 h-12 rounded-full p-0 flex items-center justify-center",
                  isActive
                    ? "bg-foreground text-background" // solid black look per theme
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                onClick={() => onTabChange(tab.id)}
                aria-label={tab.label}
                title={tab.label}
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{tab.label}</span>
              </Button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
