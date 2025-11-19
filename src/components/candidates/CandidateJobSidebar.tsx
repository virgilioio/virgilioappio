import { Briefcase, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar'
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
  const { open: isOpen } = useSidebar()
  const { jobAssociations, isLoading } = useCandidateJobAssociations(candidateId)

  if (isLoading) {
    return (
      <Sidebar className={cn('border-r', className)} collapsible="icon">
        <SidebarContent>
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </SidebarContent>
      </Sidebar>
    )
  }

  if (jobAssociations.length === 0) {
    return null
  }

  return (
    <Sidebar className={cn('border-r', className)} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {isOpen && (
              <>
                Associated Jobs
                <Badge variant="secondary" className="ml-2">
                  {jobAssociations.length}
                </Badge>
              </>
            )}
            {!isOpen && (
              <Badge variant="secondary" className="w-full justify-center">
                {jobAssociations.length}
              </Badge>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {jobAssociations.map((association) => {
                const isActive = association.job_id === currentJobId
                const jobTitle = association.job.title
                const orgName = association.job.organization?.name || 'Unknown'
                const status = association.status || 'Active'

                return (
                  <SidebarMenuItem key={association.id}>
                    <SidebarMenuButton
                      onClick={() => onJobSelect(association.job_id)}
                      isActive={isActive}
                      tooltip={isOpen ? undefined : jobTitle}
                      className={cn(
                        'cursor-pointer',
                        isActive && 'bg-accent'
                      )}
                    >
                      <Briefcase className="h-4 w-4 shrink-0" />
                      {isOpen && (
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{jobTitle}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {orgName}
                          </div>
                        </div>
                      )}
                      {isOpen && (
                        <Badge
                          variant={getStatusVariant(status)}
                          className="ml-2 shrink-0 text-xs"
                        >
                          {status}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
