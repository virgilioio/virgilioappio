import { Briefcase, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

export function CandidateJobSidebar({
  candidateId,
  currentJobId,
  onJobSelect,
  className
}: CandidateJobSidebarProps) {
  const { jobAssociations, isLoading } = useCandidateJobAssociations(candidateId)

  if (isLoading) {
    return (
      <div className={cn('w-60 border-r bg-background flex flex-col', className)}>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (jobAssociations.length === 0) {
    return null
  }

  return (
    <div className={cn('w-60 border-r bg-background flex flex-col', className)}>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="mb-3 px-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Associated Jobs
              </h3>
              <Badge variant="secondary">
                {jobAssociations.length}
              </Badge>
            </div>
          </div>
          <div className="space-y-1">
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
                    'w-full justify-start text-left h-auto py-3 px-3',
                    isActive && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Briefcase className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0 ml-2">
                    <div className="font-medium truncate text-sm">{jobTitle}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {orgName}
                    </div>
                  </div>
                  <Badge
                    variant={getStatusVariant(status)}
                    className="ml-2 shrink-0 text-xs"
                  >
                    {status}
                  </Badge>
                </Button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
