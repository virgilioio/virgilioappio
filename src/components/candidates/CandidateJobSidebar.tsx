import { Briefcase } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCandidateJobAssociations } from '@/hooks/useCandidateJobAssociations'
import { cn } from '@/lib/utils'

interface CandidateJobSidebarProps {
  candidateId: string
  currentJobId: string
  onJobSelect: (jobId: string) => void
  className?: string
}

const getStatusVariant = (status: string | null): 'default' | 'success' | 'destructive' | 'secondary' => {
  if (!status) return 'default'
  
  const lowerStatus = status.toLowerCase()
  if (lowerStatus === 'active' || lowerStatus === 'hired') return 'success'
  if (lowerStatus === 'rejected') return 'destructive'
  return 'secondary'
}

const getStatusBadgeClasses = (status: string | null): string => {
  if (!status) return 'bg-virgilio-purple/10 text-virgilio-purple border-virgilio-purple/30'
  
  const lowerStatus = status.toLowerCase()
  if (lowerStatus === 'active' || lowerStatus === 'hired') {
    return 'bg-green-500/10 text-green-700 border-green-300'
  }
  if (lowerStatus === 'rejected') {
    return 'bg-red-500/10 text-red-700 border-red-300'
  }
  return 'bg-virgilio-purple/10 text-virgilio-purple border-virgilio-purple/30'
}

export function CandidateJobSidebar({
  candidateId,
  currentJobId,
  onJobSelect,
  className
}: CandidateJobSidebarProps) {
  const { jobAssociations, isLoading } = useCandidateJobAssociations(candidateId)

  if (isLoading) {
    return (
      <div className={cn('w-64 border-r border-virgilio-border/50 bg-white flex flex-col shadow-calendly', className)}>
        <div className="p-6 bg-gradient-to-b from-virgilio-purple/5 to-transparent border-b border-virgilio-border/50">
          <h2 className="text-h4-mobile font-poppins font-bold text-virgilio-text mb-3">
            Associated Jobs<span className="text-virgilio-purple">.</span>
          </h2>
        </div>
        <div className="space-y-2 p-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 p-3">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (jobAssociations.length === 0) {
    return null
  }

  return (
    <div className={cn('w-64 border-r border-virgilio-border/50 bg-white flex flex-col shadow-calendly transition-all duration-300', className)}>
      <div className="p-6 bg-gradient-to-b from-virgilio-purple/5 to-transparent border-b border-virgilio-border/50">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-h4-mobile font-poppins font-bold text-virgilio-text">
            Associated Jobs<span className="text-virgilio-purple">.</span>
          </h2>
          <Badge variant="secondary" className="bg-virgilio-purple/10 text-virgilio-purple border-virgilio-purple/30">
            {jobAssociations.length}
          </Badge>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto scroll-smooth">
        <div className="p-4 space-y-1">
          {jobAssociations.map((association) => {
            const isActive = association.job_id === currentJobId
            const jobTitle = association.job.title
            const orgName = association.job.organization?.name || 'Unknown'
            const status = association.status || 'Active'

            return (
              <Button
                key={association.id}
                variant="ghost"
                onClick={() => onJobSelect(association.job_id)}
                className={cn(
                  'w-full justify-start text-left h-auto py-3 px-4 rounded-lg',
                  'hover:bg-virgilio-purple/5 hover:-translate-y-0.5 transition-all duration-200',
                  isActive && 'bg-virgilio-purple/10 border-l-2 border-virgilio-purple text-virgilio-text'
                )}
              >
                <Briefcase className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-virgilio-purple" : "text-virgilio-muted"
                )} />
                <div className="flex-1 min-w-0 ml-3">
                  <div className="font-medium truncate text-sm text-virgilio-text">
                    {jobTitle}
                  </div>
                  <div className="text-xs text-virgilio-muted truncate">
                    {orgName}
                  </div>
                </div>
                <Badge
                  variant={getStatusVariant(status)}
                  className={cn("ml-2 shrink-0 text-xs border", getStatusBadgeClasses(status))}
                >
                  {status}
                </Badge>
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
