import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, ChevronsUpDown, UserPlus, UserMinus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useToast } from '@/hooks/use-toast'
import { useUpdateJob } from '@/hooks/useJobs'
import { useMembersWithProfiles } from '@/hooks/useMembersWithProfiles'
import type { Job } from '@/hooks/useJobs'

interface JobAssignmentsPanelProps {
  job: Job
}

interface HiringTeamMember {
  memberId: string
  memberName: string
  memberAvatar: string
}

export function JobAssignmentsPanel({ job }: JobAssignmentsPanelProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const { mutate: updateJob, isLoading: updatingJob } = useUpdateJob()
  const { members, isLoading: loadingMembers } = useMembersWithProfiles()

  const [selectedMembers, setSelectedMembers] = useState<string[]>(job.hiring_team || [])

  const toggleMember = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== memberId))
    } else {
      setSelectedMembers([...selectedMembers, memberId])
    }
  }

  const handleSaveAssignments = async () => {
    try {
      await updateJob({
        id: job.id,
        hiring_team: selectedMembers,
      })

      toast({
        title: 'Success',
        description: 'Hiring team assignments updated successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update hiring team assignments',
        variant: 'destructive',
      })
    } finally {
      setOpen(false)
    }
  }

  const getMemberAvatar = (member: any) => {
    // Assuming you have a way to get the member's avatar URL
    return `https://avatar.vercel.sh/${member.user_email}.png`
  }

  const isMemberSelected = (memberId: string) => {
    return selectedMembers.includes(memberId)
  }

  return (
    <div className="grid gap-4">
      <h4 className="font-medium text-sm">Hiring Team</h4>

      <div className="rounded-md border bg-popover text-popover-foreground">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild className="w-full">
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between text-sm"
            >
              {selectedMembers.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  {selectedMembers.slice(0, 2).map(memberId => {
                    const member = members?.find(m => m.id === memberId)
                    if (!member) return null

                    const memberName = `${member.user_first_name || ''} ${member.user_last_name || ''}`.trim()
                    const memberAvatar = getMemberAvatar(member)

                    return (
                      <Avatar key={memberId} className="h-5 w-5">
                        <AvatarImage src={memberAvatar} alt={memberName} />
                        <AvatarFallback>{memberName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    )
                  })}
                  {selectedMembers.length > 2 && (
                    <Badge variant="secondary" className="text-[0.7rem]">
                      +{selectedMembers.length - 2}
                    </Badge>
                  )}
                </div>
              ) : (
                'Select members...'
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search members..." />
              <CommandList>
                <CommandEmpty>No members found.</CommandEmpty>
                <CommandGroup heading="Members">
                  {loadingMembers ? (
                    <CommandItem className="justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </CommandItem>
                  ) : (
                    members?.map((member) => {
                      const memberName = `${member.user_first_name || ''} ${member.user_last_name || ''}`.trim()
                      const memberAvatar = getMemberAvatar(member)
                      const isSelected = isMemberSelected(member.id)

                      return (
                        <CommandItem
                          key={member.id}
                          onSelect={() => toggleMember(member.id)}
                        >
                          <Avatar className="mr-2 h-5 w-5">
                            <AvatarImage src={memberAvatar} alt={memberName} />
                            <AvatarFallback>{memberName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span>{memberName}</span>
                          {isSelected && (
                            <Check className="ml-auto h-4 w-4" />
                          )}
                        </CommandItem>
                      )
                    })
                  )}
                </CommandGroup>
                <CommandSeparator />
                <div className="p-2">
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handleSaveAssignments}
                    disabled={updatingJob}
                  >
                    {updatingJob ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Save Assignments'
                    )}
                  </Button>
                </div>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
