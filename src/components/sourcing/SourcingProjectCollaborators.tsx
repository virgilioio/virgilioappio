import { useState, useMemo } from 'react'
import { Plus, X, Search, UserPlus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { useSourcingProjectCollaborators, Collaborator, TenantMember } from '@/hooks/useSourcingProjectCollaborators'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SourcingProjectCollaboratorsProps {
  projectId: string
  createdBy: string
}

function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase()
  if (firstName) return firstName[0].toUpperCase()
  if (email) return email[0].toUpperCase()
  return '?'
}

function getDisplayName(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) return `${firstName} ${lastName}`
  if (firstName) return firstName
  return email || 'Unknown'
}

export function SourcingProjectCollaborators({ projectId, createdBy }: SourcingProjectCollaboratorsProps) {
  const {
    collaborators,
    tenantMembers,
    isCreator,
    addCollaborator,
    removeCollaborator,
  } = useSourcingProjectCollaborators(projectId, createdBy)

  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const availableMembers = useMemo(() => {
    const collabUserIds = new Set(collaborators.map(c => c.user_id))
    return tenantMembers
      .filter(m => !collabUserIds.has(m.user_id))
      .filter(m => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
          m.email?.toLowerCase().includes(q) ||
          m.first_name?.toLowerCase().includes(q) ||
          m.last_name?.toLowerCase().includes(q)
        )
      })
  }, [tenantMembers, collaborators, searchQuery])

  const handleAdd = async (member: TenantMember) => {
    try {
      await addCollaborator.mutateAsync(member.user_id)
      toast.success(`Added ${getDisplayName(member.first_name, member.last_name, member.email)}`)
    } catch (e: any) {
      toast.error('Failed to add collaborator', { description: e.message })
    }
  }

  const handleRemove = async (collab: Collaborator) => {
    try {
      await removeCollaborator.mutateAsync(collab.id)
      toast.success(`Removed ${getDisplayName(collab.user_first_name, collab.user_last_name, collab.user_email)}`)
    } catch (e: any) {
      toast.error('Failed to remove collaborator', { description: e.message })
    }
  }

  return (
    <div className="flex items-center gap-1">
      {/* Stacked avatar group */}
      <div className="flex -space-x-2">
        {collaborators.slice(0, 4).map((collab) => (
          <Avatar
            key={collab.id}
            className="h-7 w-7 border-2 border-background ring-0"
            title={getDisplayName(collab.user_first_name, collab.user_last_name, collab.user_email)}
          >
            <AvatarImage src={collab.user_avatar_url || undefined} />
            <AvatarFallback className="text-[10px] bg-pastel-purple text-text-primary">
              {getInitials(collab.user_first_name, collab.user_last_name, collab.user_email)}
            </AvatarFallback>
          </Avatar>
        ))}
        {collaborators.length > 4 && (
          <Avatar className="h-7 w-7 border-2 border-background">
            <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
              +{collaborators.length - 4}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Invite button - only for project creator */}
      {isCreator && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full border border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5"
              title="Add collaborator"
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="p-3 border-b">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Add Collaborators</span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search team members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {/* Current collaborators */}
            {collaborators.length > 0 && (
              <div className="p-2 border-b">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">
                  Collaborators ({collaborators.length})
                </span>
                <div className="mt-1 space-y-0.5">
                  {collaborators.map((collab) => (
                    <div
                      key={collab.id}
                      className="flex items-center justify-between p-1.5 rounded-md hover:bg-muted/50 group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={collab.user_avatar_url || undefined} />
                          <AvatarFallback className="text-[9px] bg-pastel-purple text-text-primary">
                            {getInitials(collab.user_first_name, collab.user_last_name, collab.user_email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate text-foreground">
                            {getDisplayName(collab.user_first_name, collab.user_last_name, collab.user_email)}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">{collab.user_email}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemove(collab)}
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available members */}
            <div className="p-2 max-h-48 overflow-y-auto">
              {availableMembers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  {searchQuery ? 'No matching team members' : 'All team members added'}
                </p>
              ) : (
                <div className="space-y-0.5">
                  {availableMembers.map((member) => (
                    <button
                      key={member.user_id}
                      className="flex items-center gap-2 w-full p-1.5 rounded-md hover:bg-muted/50 transition-colors text-left"
                      onClick={() => handleAdd(member)}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                          {getInitials(member.first_name, member.last_name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate text-foreground">
                          {getDisplayName(member.first_name, member.last_name, member.email)}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
