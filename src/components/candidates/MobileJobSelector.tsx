import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Briefcase, Loader2 } from 'lucide-react'
import { useCandidateJobAssociations } from '@/hooks/useCandidateJobAssociations'
import { cn } from '@/lib/utils'

interface MobileJobSelectorProps {
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

export function MobileJobSelector({
  candidateId,
  currentJobId,
  onJobSelect,
  className
}: MobileJobSelectorProps) {
  const { jobAssociations, isLoading } = useCandidateJobAssociations(candidateId)

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 p-3 bg-muted/50 rounded-lg', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading jobs...</span>
      </div>
    )
  }

  if (jobAssociations.length === 0) {
    return null
  }

  const currentJob = jobAssociations.find(j => j.job_id === currentJobId)
  const currentJobTitle = currentJob?.job.title || 'Select Job'

  return (
    <div className={cn('lg:hidden', className)}>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
        Associated Jobs ({jobAssociations.length})
      </label>
      <Select value={currentJobId} onValueChange={onJobSelect}>
        <SelectTrigger className="w-full h-11">
          <SelectValue>
            <span className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-virgilio-purple" />
              <span className="truncate">{currentJobTitle}</span>
              {currentJob && (
                <Badge variant={getStatusVariant(currentJob.status)} className="text-xs">
                  {currentJob.status || 'Active'}
                </Badge>
              )}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {jobAssociations.map((association) => (
            <SelectItem key={association.id} value={association.job_id} className="py-3">
              <div className="flex items-center gap-2 w-full">
                <Briefcase className={cn(
                  "h-4 w-4 shrink-0",
                  association.job_id === currentJobId ? "text-virgilio-purple" : "text-muted-foreground"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm">
                    {association.job.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {association.job.organization?.name || 'Unknown'}
                  </div>
                </div>
                <Badge variant={getStatusVariant(association.status)} className="shrink-0 text-xs">
                  {association.status || 'Active'}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
