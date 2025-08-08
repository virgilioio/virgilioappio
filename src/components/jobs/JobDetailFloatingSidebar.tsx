
import { cn } from '@/lib/utils'
import { FileText, Users, Settings, Kanban } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
      id: 'overview',
      label: 'Overview',
      icon: FileText,
    },
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
    <Card className={cn("w-64 h-fit", className)}>
      <CardContent className="p-4">
        <div className="mb-4">
          <h3 className="font-medium text-text-primary text-sm truncate" title={jobTitle}>
            {jobTitle}
          </h3>
        </div>
        
        <div className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = currentTab === tab.id
            
            return (
              <Button
                key={tab.id}
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start h-10 px-3 py-2",
                  "text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon className="h-4 w-4 mr-3 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
