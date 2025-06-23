
import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from '@/components/ui/button'
import { useMembersWithProfiles } from '@/hooks/useMembersWithProfiles'
import { useUpdateJob } from '@/hooks/useJobs'

interface JobAssignmentsPanelProps {
  job: {
    id: string
    hiring_team: string[] | null
  }
}

export function JobAssignmentsPanel({ job }: JobAssignmentsPanelProps) {
  const { members, isLoading: loadingMembers } = useMembersWithProfiles()
  const updateJobMutation = useUpdateJob()
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    Array.isArray(job.hiring_team) ? job.hiring_team : []
  )

  const handleMemberToggle = (memberId: string) => {
    setSelectedMembers((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId)
      } else {
        return [...prev, memberId]
      }
    })
  }

  const handleSave = async () => {
    await updateJobMutation.mutateAsync({
      id: job.id,
      hiring_team: selectedMembers,
    })
  }

  if (loadingMembers) {
    return <div className="text-center py-4">Loading members...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hiring Team Assignments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Assigned Members</h4>
          <ScrollArea className="h-[200px] w-full rounded-md border">
            <div className="p-2 space-y-2">
              {members
                ?.filter((member) => selectedMembers.includes(member.user_email || member.invited_email || ''))
                .map((member) => {
                  const memberName = `${member.user_first_name || ''} ${member.user_last_name || ''}`.trim()
                  const displayName = memberName || member.user_email || member.invited_email || 'Unknown Member'

                  return (
                    <div key={member.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span>{displayName}</span>
                      <Button variant="outline" size="sm" onClick={() => handleMemberToggle(member.user_email || member.invited_email || '')}>
                        Remove
                      </Button>
                    </div>
                  )
                })}
              {selectedMembers.length === 0 && (
                <div className="text-center py-4 text-gray-500">No members assigned</div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Available Members</h4>
          <ScrollArea className="h-[200px] w-full rounded-md border">
            <div className="p-2 space-y-2">
              {members
                ?.filter((member) => !selectedMembers.includes(member.user_email || member.invited_email || ''))
                .map((member) => {
                  const memberName = `${member.user_first_name || ''} ${member.user_last_name || ''}`.trim()
                  const displayName = memberName || member.user_email || member.invited_email || 'Unknown Member'

                  return (
                    <div key={member.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span>{displayName}</span>
                      <Button variant="outline" size="sm" onClick={() => handleMemberToggle(member.user_email || member.invited_email || '')}>
                        Assign
                      </Button>
                    </div>
                  )
                })}
              {members?.filter((member) => !selectedMembers.includes(member.user_email || member.invited_email || '')).length === 0 && (
                <div className="text-center py-4 text-gray-500">No members available</div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={updateJobMutation.isPending}
            variant="default"
          >
            {updateJobMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
