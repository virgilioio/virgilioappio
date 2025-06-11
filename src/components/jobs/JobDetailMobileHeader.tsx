
import { Button } from '@/components/ui/button'
import { Menu, ArrowLeft } from 'lucide-react'

interface JobDetailMobileHeaderProps {
  jobTitle: string
  onMenuToggle: () => void
  onBackToJobs: () => void
}

export function JobDetailMobileHeader({ jobTitle, onMenuToggle, onBackToJobs }: JobDetailMobileHeaderProps) {
  return (
    <div className="flex md:hidden items-center justify-between p-3 border-b bg-surface-primary">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBackToJobs}
          className="shrink-0 min-h-[40px] min-w-[40px] hover:scale-110 transition-all duration-150 ease-in-out"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-md font-medium text-text-primary truncate">{jobTitle}</h1>
        </div>
      </div>
      
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onMenuToggle}
        className="shrink-0 min-h-[40px] min-w-[40px] hover:scale-110 transition-all duration-150 ease-in-out"
      >
        <Menu className="h-4 w-4" />
      </Button>
    </div>
  )
}
