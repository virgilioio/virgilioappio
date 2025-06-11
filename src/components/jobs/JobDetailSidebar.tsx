
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
    <nav className={cn("flex flex-col gap-1 p-3", className)}>
      {/* Job Title */}
      <div className="px-2 py-2 mb-3 border-b border-border/50">
        <h2 className="text-md font-poppins font-medium text-text-primary truncate">
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
              "w-full justify-start h-10 px-2 py-1 transition-all duration-150 ease-in-out",
              "text-sm font-medium",
              isActive 
                ? "bg-accent text-accent-foreground shadow-neumorphic" 
                : "text-text-secondary hover:text-text-primary hover:bg-accent/50 hover:translate-x-1"
            )}
            onClick={() => onTabChange(item.id)}
          >
            <Icon className="h-4 w-4 mr-2 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Button>
        )
      })}
    </nav>
  )
}
