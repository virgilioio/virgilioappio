
import { Briefcase, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface JobDetailNavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface JobDetailSidebarProps {
  currentTab: string
  onTabChange: (tab: string) => void
  jobTitle: string
  className?: string
}

export function JobDetailSidebar({ currentTab, onTabChange, jobTitle, className }: JobDetailSidebarProps) {
  const navItems: JobDetailNavItem[] = [
    { 
      id: 'overview', 
      label: 'Overview', 
      icon: Briefcase
    },
    { 
      id: 'candidates', 
      label: 'Candidates', 
      icon: Users
    },
  ]

  return (
    <nav className={cn("flex flex-col gap-1 p-2", className)}>
      {/* Job Title */}
      <div className="px-3 py-2 mb-4">
        <h2 className="heading-sm font-poppins font-semibold text-primary truncate">
          {jobTitle}
        </h2>
      </div>
      
      {navItems.map((item) => {
        const isActive = currentTab === item.id
        const Icon = item.icon
        
        return (
          <Button
            key={item.id}
            variant={isActive ? "default" : "ghost"}
            className={cn(
              "w-full justify-start h-11 px-3 py-2.5",
              "text-md font-medium",
              isActive 
                ? "bg-accent text-accent-foreground shadow-neumorphic" 
                : "text-text-secondary hover:text-text-primary hover:bg-accent/50"
            )}
            onClick={() => onTabChange(item.id)}
          >
            <Icon className="h-5 w-5 mr-3 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Button>
        )
      })}
    </nav>
  )
}
