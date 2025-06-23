
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { OrganizationDisplay } from '@/components/settings/OrganizationDisplay'
import { Organization } from '@/hooks/useOrganizations'
import { useMembers } from '@/hooks/useMembers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Mail, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface OrganizationDetailsDialogProps {
  organization: Organization | null
  isOpen: boolean
  onClose: () => void
}

export function OrganizationDetailsDialog({ 
  organization, 
  isOpen, 
  onClose 
}: OrganizationDetailsDialogProps) {
  const { members, isLoading: membersLoading } = useMembers()
  
  if (!organization) return null

  // Filter members for this organization
  const organizationMembers = members.filter(member => 
    member.organization_id === organization.id
  )

  const getMemberDisplayName = (member: any) => {
    if (member.user_first_name || member.user_last_name) {
      return `${member.user_first_name || ''} ${member.user_last_name || ''}`.trim()
    }
    return member.user_email || member.invited_email || 'Unknown User'
  }

  const getMemberEmail = (member: any) => {
    return member.user_email || member.invited_email || 'No email provided'
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
      invited: 'outline'
    } as const

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const getRoleBadge = (role: string) => {
    const roleColors = {
      admin: 'destructive',
      recruiter: 'default',
      customer_success: 'secondary',
      billing: 'outline',
      sales: 'outline',
      client: 'outline'
    } as const

    return (
      <Badge variant={roleColors[role as keyof typeof roleColors] || 'outline'}>
        {role.replace('_', ' ').charAt(0).toUpperCase() + role.replace('_', ' ').slice(1)}
      </Badge>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Organization Details: {organization.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Organization Information - Takes 2 columns */}
          <div className="lg:col-span-2">
            <OrganizationDisplay organization={organization} />
          </div>
          
          {/* Members Section - Takes 1 column */}
          <div className="lg:col-span-1">
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-4 w-4" />
                  Organization Members
                  <Badge variant="outline" className="ml-auto">
                    {organizationMembers.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {membersLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse">
                        <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : organizationMembers.length > 0 ? (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {organizationMembers.map(member => (
                      <div key={member.id} className="border border-border/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {getMemberDisplayName(member)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {getMemberEmail(member)}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          {getRoleBadge(member.member_role)}
                          {getStatusBadge(member.user_status)}
                        </div>
                        
                        {member.user_status === 'invited' && (
                          <div className="text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                            Invitation pending
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">
                      No members found for this organization
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
