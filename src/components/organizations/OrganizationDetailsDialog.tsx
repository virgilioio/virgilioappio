
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { OrganizationDisplay } from '@/components/settings/OrganizationDisplay'
import { OrganizationComplianceEditor } from './OrganizationComplianceEditor'
import { Organization } from '@/hooks/useOrganizations'
import { useMembers } from '@/hooks/useMembers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { User, Mail, Users, MoreVertical, Trash2, Edit, Eye } from 'lucide-react'
import { UserDeletionDialog } from './UserDeletionDialog'
import { usePermissions } from '@/hooks/usePermissions'

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
  const { members, isLoading: membersLoading, getMembers } = useMembers()
  const permissions = usePermissions()
  const [selectedUserForDeletion, setSelectedUserForDeletion] = useState<{
    id: string | null
    memberId: string
    email: string
    firstName?: string
    lastName?: string
    userStatus: string
  } | null>(null)
  const [isDeletionDialogOpen, setIsDeletionDialogOpen] = useState(false)
  const [userIsBillingPoc, setUserIsBillingPoc] = useState(false)
  const [isEditingCompliance, setIsEditingCompliance] = useState(false)
  
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

  const handleDeleteUser = (member: any) => {
    const isBillingPoc = organization.billing_poc_user_id === member.user_id
    
    setSelectedUserForDeletion({
      id: member.user_id,
      memberId: member.id,
      email: getMemberEmail(member),
      firstName: member.user_first_name,
      lastName: member.user_last_name,
      userStatus: member.user_status
    })
    setUserIsBillingPoc(isBillingPoc)
    setIsDeletionDialogOpen(true)
  }

  const handleUserDeleted = () => {
    getMembers()
  }

  const handleComplianceSave = () => {
    setIsEditingCompliance(false)
    // The compliance data will be automatically refreshed by the hooks
  }

  const handleComplianceCancel = () => {
    setIsEditingCompliance(false)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">
                Organization Details: {organization.name}
              </DialogTitle>
              {permissions.isPlatformAdmin && (
                <Button
                  variant={isEditingCompliance ? "outline" : "default"}
                  size="sm"
                  onClick={() => setIsEditingCompliance(!isEditingCompliance)}
                  className="flex items-center gap-2"
                >
                  {isEditingCompliance ? (
                    <>
                      <Eye className="h-4 w-4" />
                      View Mode
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4" />
                      Edit Compliance
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
            {/* Organization Information - Takes 2 columns */}
            <div className="lg:col-span-2">
              {isEditingCompliance ? (
                <OrganizationComplianceEditor
                  organization={organization}
                  onSave={handleComplianceSave}
                  onCancel={handleComplianceCancel}
                />
              ) : (
                <OrganizationDisplay organization={organization} />
              )}
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
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm font-medium">
                                  {getMemberDisplayName(member)}
                                </span>
                                {organization.billing_poc_user_id === member.user_id && (
                                  <Badge variant="outline" className="text-xs">
                                    Billing POC
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {getMemberEmail(member)}
                                </span>
                              </div>
                            </div>
                            
                            {permissions.isPlatformAdmin && member.user_id && member.user_status === 'active' && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteUser(member)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3 mr-2" />
                                    Delete User
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
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

      <UserDeletionDialog
        isOpen={isDeletionDialogOpen}
        onClose={() => setIsDeletionDialogOpen(false)}
        userToDelete={selectedUserForDeletion}
        organizationId={organization?.id}
        isBillingPoc={userIsBillingPoc}
        onUserDeleted={handleUserDeleted}
      />
    </>
  )
}
