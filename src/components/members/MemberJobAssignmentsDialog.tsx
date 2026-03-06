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
  const [jobs, setJobs] = useState<Job[]>([])
  const [assignedJobIds, setAssignedJobIds] = useState<Set<string>>(new Set())
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
        .select('job_id')
        .eq('user_id', member.user_id)

      if (assignmentsError) throw assignmentsError
      
      const assignedIds = new Set(assignmentsData?.map(a => a.job_id) || [])
      setAssignedJobIds(assignedIds)
      setPendingChanges({ add: [], remove: [] })
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

  const handleSave = async () => {
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
          organization_id: member.organization_id
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
          <div className="py-8 text-center text-muted-foreground">
            <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No jobs available in this organization.</p>
          </div>
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
                  <Badge variant={job.status === 'open' ? 'default' : 'secondary'} className="text-xs">
                    {job.status}
                  </Badge>
                </label>
              ))}
            </div>
          </ScrollArea>
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
            <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
