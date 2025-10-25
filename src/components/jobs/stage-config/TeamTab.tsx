import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStageInterviewerAssignments } from '@/hooks/useStageInterviewerAssignments'
import { useMembers } from '@/hooks/useMembers'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { getOrganizationTree } from '@/lib/organizationHelpers'
import { User, UserPlus, Users, Trash2, Info, Loader2 } from 'lucide-react'

interface TeamTabProps {
  jhsId: string
  jobId: string
  organizationId: string
}

export function TeamTab({ jhsId, jobId, organizationId }: TeamTabProps) {
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [selectedType, setSelectedType] = useState<'required' | 'optional' | 'backup'>('required')
  const [orgTree, setOrgTree] = useState<string[]>([organizationId])
  
  const { interviewers, isLoading, addInterviewer, removeInterviewer, updateAssignmentType } = 
    useStageInterviewerAssignments(jhsId)
  const { members } = useMembers()
  const { assignments } = useJobAssignments(jobId)
  
  // Build sets for quick lookups
  const assignedMemberIds = new Set(interviewers.map(i => i.member_id))
  const jobAssignedUserIds = new Set(assignments.map(a => a.user_id))

  // Fetch organization tree on mount
  useEffect(() => {
    async function loadOrgTree() {
      const tree = await getOrganizationTree(organizationId)
      setOrgTree(tree)
    }
    loadOrgTree()
  }, [organizationId])
  
  // Filter members: only active members from org tree, not already stage interviewers
  const availableMembers = members.filter(m => 
    m.user_id && 
    m.user_status === 'active' &&
    orgTree.includes(m.organization_id) &&
    !assignedMemberIds.has(m.id)
  )
  
  // Check if selected member is already on job team
  const selectedMember = members.find(m => m.id === selectedMemberId)
  const isSelectedAlreadyOnJobTeam = selectedMember?.user_id 
    ? jobAssignedUserIds.has(selectedMember.user_id)
    : false
  
  const handleAdd = async () => {
    if (!selectedMemberId || !selectedMember) return
    
    await addInterviewer.mutateAsync({
      jhsId,
      memberId: selectedMemberId,
      assignmentType: selectedType,
      jobId,
      organizationId,
      isAlreadyAssignedToJob: isSelectedAlreadyOnJobTeam
    })
    
    setSelectedMemberId('')
    setSelectedType('required')
  }
  
  const handleRemove = async (assignmentId: string, memberName: string) => {
    if (confirm(`Remove ${memberName} as an interviewer for this stage?`)) {
      await removeInterviewer.mutateAsync({ assignmentId, jhsId })
    }
  }
  
  const handleTypeChange = async (assignmentId: string, newType: 'required' | 'optional' | 'backup') => {
    await updateAssignmentType.mutateAsync({ 
      assignmentId, 
      assignmentType: newType,
      jhsId
    })
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <section aria-labelledby="team-header">
        <h3 id="team-header" className="text-sm font-medium text-foreground mb-1">
          Stage Interviewers
        </h3>
        <p className="text-sm text-muted-foreground">
          Assign team members who will conduct interviews at this stage
        </p>
      </section>
      
      {/* Add Interviewer Form */}
      <section aria-labelledby="add-interviewer" className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h4 id="add-interviewer" className="text-sm font-medium">Add Interviewer</h4>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="member-select">Select Team Member</Label>
            <SearchableSelect
                options={availableMembers.map(m => {
                  const name = `${m.user_first_name || ''} ${m.user_last_name || ''}`.trim() || m.user_email || 'Unnamed'
                  const isOnJobTeam = m.user_id ? jobAssignedUserIds.has(m.user_id) : false
                  const isSameOrg = m.organization_id === organizationId
                  
                  return {
                    value: m.id,
                    label: isSameOrg ? name : `${name} (${m.organization_name || 'Other org'})`,
                    badge: isOnJobTeam ? 'On Job Team' : 'Will be added to team',
                    badgeVariant: isOnJobTeam ? 'secondary' : 'default'
                  }
                })}
              value={selectedMemberId}
              onValueChange={setSelectedMemberId}
              placeholder="Search for a team member..."
              disabled={addInterviewer.isPending}
            />
          </div>
          
          {selectedMemberId && !isSelectedAlreadyOnJobTeam && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>{selectedMember?.user_first_name || 'This person'}</strong> will be added to the job's Hiring Team automatically
                </p>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="assignment-type">Assignment Type</Label>
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as any)}>
              <SelectTrigger id="assignment-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="required">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs">Required</Badge>
                    <span className="text-xs text-muted-foreground">Must participate</span>
                  </div>
                </SelectItem>
                <SelectItem value="optional">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Optional</Badge>
                    <span className="text-xs text-muted-foreground">Can participate</span>
                  </div>
                </SelectItem>
                <SelectItem value="backup">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Backup</Badge>
                    <span className="text-xs text-muted-foreground">Covers absences</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button
            onClick={handleAdd}
            disabled={!selectedMemberId || addInterviewer.isPending}
            className="w-full"
          >
            {addInterviewer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <UserPlus className="mr-2 h-4 w-4" />
            Add Interviewer
          </Button>
        </div>
      </section>
      
      {/* Current Interviewers List */}
      <section aria-labelledby="current-interviewers">
        <div className="flex items-center justify-between mb-3">
          <h4 id="current-interviewers" className="text-sm font-medium">
            Current Interviewers
          </h4>
          <Badge variant="secondary">{interviewers.length}</Badge>
        </div>
        
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-20 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : interviewers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No interviewers assigned yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use the form above to assign team members
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {interviewers.map(interviewer => (
              <div key={interviewer.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{interviewer.member_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{interviewer.member_email}</p>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {interviewer.member_role}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={interviewer.assignment_type}
                      onValueChange={(v) => handleTypeChange(interviewer.id, v as any)}
                      disabled={updateAssignmentType.isPending}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Required</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                        <SelectItem value="backup">Backup</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(interviewer.id, interviewer.member_name)}
                      disabled={removeInterviewer.isPending}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      
      {/* Info Box */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <p><strong>Assignment Types:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
              <li><strong>Required:</strong> Must participate in interviews at this stage</li>
              <li><strong>Optional:</strong> Can participate if available</li>
              <li><strong>Backup:</strong> Covers when primary interviewers are unavailable</li>
            </ul>
            <p className="text-xs mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
              <strong>Note:</strong> Removing someone from this stage does not remove them from the job's Hiring Team. Manage that in the Hiring Team tab.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
