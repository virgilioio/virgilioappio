import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { Briefcase, Loader2 } from 'lucide-react'
import { Member } from '@/hooks/useMembers'
import { useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftFlag } from '@/components/ui/EmptyIllustrations'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { JobAssignmentRole } from '@/hooks/useJobAssignments'

const ROLE_LABEL: Record<JobAssignmentRole, string> = {
  interviewer: 'Interviewer',
  hiring_manager: 'Hiring manager',
  sourcer: 'Sourcer',
  recruiter: 'Recruiter',
}

interface MemberJobAssignmentsDialogProps {
  isOpen: boolean
  onClose: () => void
  member: Member | null
}

interface Job {
  id: string
  title: string
  status: string
  department: string | null
}

export function MemberJobAssignmentsDialog({ 
  isOpen, 
  onClose, 
  member 
}: MemberJobAssignmentsDialogProps) {
  const queryClient = useQueryClient()
  const [jobs, setJobs] = useState<Job[]>([])
  const [assignedJobIds, setAssignedJobIds] = useState<Set<string>>(new Set())
  // One seat per job: the role they hold where they're on the team already.
  const [seatRoles, setSeatRoles] = useState<Map<string, JobAssignmentRole>>(new Map())
  // The role they take on the jobs ticked here; the least access by default.
  const [addRole, setAddRole] = useState<JobAssignmentRole>('interviewer')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<{ add: string[], remove: string[] }>({ add: [], remove: [] })

  useEffect(() => {
    if (isOpen && member?.user_id && member?.organization_id) {
      loadJobsAndAssignments()
    }
  }, [isOpen, member])

  const loadJobsAndAssignments = async () => {
    if (!member?.user_id || !member?.organization_id) return
    
    setIsLoading(true)
    try {
      // Fetch jobs for the member's organization
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('id, title, status, department')
        .eq('organization_id', member.organization_id)
        .is('deleted_at', null)
        .in('status', ['open', 'draft'])
        .order('created_at', { ascending: false })

      if (jobsError) throw jobsError
      setJobs(jobsData || [])

      // Fetch current job assignments for this user
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('job_assignments')
        .select('job_id, role')
        .eq('user_id', member.user_id)
        .is('deleted_at', null)

      if (assignmentsError) throw assignmentsError
      
      const assignedIds = new Set(assignmentsData?.map(a => a.job_id) || [])
      setAssignedJobIds(assignedIds)
      setSeatRoles(new Map((assignmentsData || []).map(a => [a.job_id, a.role as JobAssignmentRole])))
      setPendingChanges({ add: [], remove: [] })
      setAddRole('interviewer')
    } catch (error) {
      console.error('Error loading jobs/assignments:', error)
      toast({
        title: 'Error',
        description: 'Failed to load job assignments',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleJobAssignment = (jobId: string) => {
    const isCurrentlyAssigned = assignedJobIds.has(jobId)
    const isInAddList = pendingChanges.add.includes(jobId)
    const isInRemoveList = pendingChanges.remove.includes(jobId)

    if (isCurrentlyAssigned) {
      // Currently assigned - toggle remove
      if (isInRemoveList) {
        setPendingChanges(prev => ({ ...prev, remove: prev.remove.filter(id => id !== jobId) }))
      } else {
        setPendingChanges(prev => ({ ...prev, remove: [...prev.remove, jobId] }))
      }
    } else {
      // Not currently assigned - toggle add
      if (isInAddList) {
        setPendingChanges(prev => ({ ...prev, add: prev.add.filter(id => id !== jobId) }))
      } else {
        setPendingChanges(prev => ({ ...prev, add: [...prev.add, jobId] }))
      }
    }
  }

  const isJobSelected = (jobId: string) => {
    const isCurrentlyAssigned = assignedJobIds.has(jobId)
    const isInAddList = pendingChanges.add.includes(jobId)
    const isInRemoveList = pendingChanges.remove.includes(jobId)
    
    if (isCurrentlyAssigned) {
      return !isInRemoveList
    }
    return isInAddList
  }

  const hasChanges = pendingChanges.add.length > 0 || pendingChanges.remove.length > 0

  const handleSaveClick = async () => {
    if (!member?.user_id || !member?.organization_id) return

    // S5 (Block B §16): unticking jobs removes assignments, so Save asks first.
    const removing = pendingChanges.remove
    if (removing.length > 0) {
      const titles = removing.map(id => jobs.find(j => j.id === id)?.title || 'Untitled job')
      const first = member.user_first_name?.trim() || memberName
      const many = removing.length > 1
      const adding = pendingChanges.add.length
      const ok = await confirmDestructive({
        variant: 'remove',
        title: many ? `Remove ${memberName} from ${removing.length} jobs?` : `Remove ${memberName} from ${titles[0]}?`,
        description: `${first} comes off ${many ? 'these jobs' : 'this job'}. Their notes and scorecards stay.${adding ? ` The ${adding === 1 ? 'job' : `${adding} jobs`} you ticked ${adding === 1 ? 'is' : 'are'} added at the same time.` : ''}`,
        items: many ? titles.slice(0, 3) : undefined,
        itemsTotal: many ? titles.length : undefined,
        confirmLabel: many ? `Remove from ${removing.length} jobs` : 'Remove from job',
      })
      if (!ok) return
    }
    
    executeSave()
  }

  const executeSave = async () => {
    if (!member?.user_id || !member?.organization_id) return
    
    setIsSaving(true)
    try {
      // Remove assignments
      if (pendingChanges.remove.length > 0) {
        const { error: removeError } = await supabase
          .from('job_assignments')
          .delete()
          .eq('user_id', member.user_id)
          .in('job_id', pendingChanges.remove)

        if (removeError) throw removeError
      }

      // Add new assignments
      if (pendingChanges.add.length > 0) {
        const newAssignments = pendingChanges.add.map(jobId => ({
          job_id: jobId,
          user_id: member.user_id,
          organization_id: member.organization_id,
          role: addRole,
        }))

        const { error: addError } = await supabase
          .from('job_assignments')
          .insert(newAssignments)

        if (addError) throw addError
      }

      toast({
        title: 'Success',
        description: 'Job assignments updated successfully'
      })

      // Sync seat count — recruiter assignment changes affect billing
      try {
        await supabase.functions.invoke('update-seat-quantity')
        queryClient.invalidateQueries({ queryKey: ['billing-status'] })
        queryClient.invalidateQueries({ queryKey: ['recruiter-user-ids'] })
      } catch (e) {
        console.warn('Seat sync after job assignment change failed (non-fatal):', e)
      }
      
      onClose()
    } catch (error) {
      console.error('Error saving job assignments:', error)
      toast({
        title: 'Error',
        description: 'Failed to update job assignments',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const memberName = member?.user_first_name && member?.user_last_name 
    ? `${member.user_first_name} ${member.user_last_name}`
    : member?.user_email || member?.invited_email || 'this member'

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Manage Job Access
          </DialogTitle>
          <DialogDescription>
            Select which jobs <strong>{memberName}</strong> can access. Hiring Managers and Interviewers only see jobs they're assigned to.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            size="card"
            illustration={<SoftFlag />}
            title="No jobs available"
            body="There are no jobs in this organization yet."
          />
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-2 py-2">
              {jobs.map(job => (
                <label
                  key={job.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/5 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={isJobSelected(job.id)}
                    onCheckedChange={() => toggleJobAssignment(job.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{job.title}</div>
                    {job.department && (
                      <div className="text-xs text-muted-foreground">{job.department}</div>
                    )}
                  </div>
                  {seatRoles.get(job.id) && isJobSelected(job.id) && (
                    <span className="shrink-0 text-xs text-muted-foreground">{ROLE_LABEL[seatRoles.get(job.id)!]}</span>
                  )}
                  <Badge variant={job.status === 'open' ? 'default' : 'secondary'} className="text-xs">
                    {job.status}
                  </Badge>
                </label>
              ))}
            </div>
          </ScrollArea>
        )}

        {pendingChanges.add.length > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Joins {pendingChanges.add.length === 1 ? 'the job' : `the ${pendingChanges.add.length} jobs`} you ticked as
            </span>
            <Select value={addRole} onValueChange={(v) => setAddRole(v as JobAssignmentRole)}>
              <SelectTrigger className="h-9 w-[170px]" aria-label="Role on the jobs you add">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* External users (2026-10-24) are hiring managers or interviewers only. */}
                {(Object.keys(ROLE_LABEL) as JobAssignmentRole[])
                  .filter((r) => member?.user_type !== 'external' || r === 'hiring_manager' || r === 'interviewer')
                  .map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            {pendingChanges.add.length > 0 && (
              <span className="text-success">+{pendingChanges.add.length} to add</span>
            )}
            {pendingChanges.add.length > 0 && pendingChanges.remove.length > 0 && <span>, </span>}
            {pendingChanges.remove.length > 0 && (
              <span className="text-destructive">−{pendingChanges.remove.length} to remove</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveClick()} disabled={!hasChanges || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
