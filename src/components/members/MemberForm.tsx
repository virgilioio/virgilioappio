
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Member } from "@/hooks/useMembers"
import { useOrganizations } from "@/hooks/useOrganizations"
import { usePermissions } from "@/hooks/usePermissions"
import { useAuth } from "@/contexts/AuthContext"

interface MemberFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => Promise<void>
  member?: Member | null
  isLoading: boolean
}

export function MemberForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  member, 
  isLoading 
}: MemberFormProps) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<string>("")
  const [userType, setUserType] = useState<string>("")
  const [organizationId, setOrganizationId] = useState<string>("")
  const [status, setStatus] = useState<string>("invited")
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const { organizations } = useOrganizations()
  const permissions = usePermissions()
  const { memberRole, userType: currentUserType } = useAuth()
  
  // Check if current user is Customer Success or Workspace Owner
  const isCustomerSuccess = memberRole === 'customer_success'
  const isWorkspaceOwner = currentUserType === 'workspace_owner'

  useEffect(() => {
    if (member) {
      setEmail(member.user_email || "")
      setRole(member.member_role)
      setUserType(member.user_type || "member")
      setOrganizationId(member.organization_id)
      setStatus(member.user_status)
    } else {
      setEmail("")
      setRole("")
      setUserType("")
      setOrganizationId("")
      setStatus("invited")
    }
    setErrors({})
  }, [member, isOpen])

  // Auto-set role when user type changes
  useEffect(() => {
    if (userType === 'workspace_owner') {
      setRole('client')
    } else if (userType === 'platform_admin') {
      setRole('admin')
    } else if (userType === 'guest') {
      setRole('client') // Guests are typically clients
    } else if (userType === 'member' && !role) {
      setRole('client') // Default role for members
    }
    
    // For Workspace Owners, always set role to "client" regardless of user type
    if (isWorkspaceOwner && !member) {
      setRole('client')
    }
  }, [userType, role, isWorkspaceOwner, member])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!member && !email.trim()) {
      newErrors.email = "Email is required"
    } else if (!member && email && !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email"
    }

    // For Customer Success users and Workspace Owners, role is auto-assigned, so don't validate it
    if (!isCustomerSuccess && !isWorkspaceOwner && !role) {
      newErrors.role = "Role is required"
    }

    if (!userType) {
      newErrors.userType = "User type is required"
    }

    // Only Platform Admins and Customer Success need to select organization (not Workspace Owners)
    if (!organizationId && permissions.isPlatformAdmin && !isWorkspaceOwner) {
      newErrors.organizationId = "Organization is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      const data: any = {
        member_role: role,
        user_status: status,
        user_type: userType,
      }

      if (!member) {
        // Creating new member (invitation)
        data.user_id = null
        data.email = email.trim() // Include email for invitation
        if (permissions.isPlatformAdmin || isCustomerSuccess) {
          data.organization_id = organizationId
        } else if (isWorkspaceOwner) {
          // For workspace owners, use their organization
          const userOrg = organizations.find(org => org.owner_id === null)
          data.organization_id = userOrg?.id || organizations[0]?.id
        } else {
          // For other users, use their organization
          const userOrg = organizations.find(org => org.owner_id === null)
          data.organization_id = userOrg?.id || organizations[0]?.id
        }
      } else if (permissions.isPlatformAdmin) {
        // Platform admins can change organization
        data.organization_id = organizationId
      }

      await onSubmit(data)
      onClose()
    } catch (error) {
      console.error('Error submitting form:', error)
    }
  }

  const roleOptions = [
    { value: 'recruiter', label: 'Recruiter' },
    { value: 'customer_success', label: 'Customer Success' },
    { value: 'billing', label: 'Billing' },
    { value: 'sales', label: 'Sales' },
    { value: 'admin', label: 'Admin' },
    { value: 'platform_admin', label: 'Platform Admin' },
    { value: 'client', label: 'Client' },
  ]

  // For Customer Success users and Workspace Owners, limit user type options
  const getUserTypeOptions = () => {
    if (isCustomerSuccess || isWorkspaceOwner) {
      return [
        { value: 'workspace_owner', label: 'Workspace Owner' },
        { value: 'guest', label: 'Guest' },
      ]
    }
    return [
      { value: 'guest', label: 'Guest' },
      { value: 'member', label: 'Member' },
      { value: 'workspace_owner', label: 'Workspace Owner' },
      { value: 'platform_admin', label: 'Platform Admin' },
    ]
  }

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'invited', label: 'Invited' },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {member ? 'Edit Member' : 'Invite New User'}
          </DialogTitle>
          <DialogDescription>
            {member 
              ? 'Update member role, type and status.'
              : isCustomerSuccess 
                ? 'Invite a new user to join an organization as either a Workspace Owner or Guest.'
                : isWorkspaceOwner
                  ? 'Invite a new user to your organization as either a Workspace Owner or Guest.'
                  : 'Send an invitation to join the organization.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-token-md py-token-md">
            {/* Email field - only for new invitations */}
            {!member && (
              <div className="grid gap-token-sm">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  An invitation email will be sent to this address
                </p>
              </div>
            )}

            {/* Show current email for existing members */}
            {member && member.user_email && (
              <div className="grid gap-token-sm">
                <Label>Email Address</Label>
                <div className="px-3 py-2 bg-muted rounded-md text-sm">
                  {member.user_email}
                </div>
              </div>
            )}

            {/* User Type field - always show for platform admins, customer success, and workspace owners */}
            {(permissions.isPlatformAdmin || isCustomerSuccess || isWorkspaceOwner) && (
              <div className="grid gap-token-sm">
                <Label htmlFor="userType">User Type</Label>
                <Select value={userType} onValueChange={setUserType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user type" />
                  </SelectTrigger>
                  <SelectContent>
                    {getUserTypeOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.userType && (
                  <p className="text-sm text-destructive">{errors.userType}</p>
                )}
                {(isCustomerSuccess || isWorkspaceOwner) && (
                  <p className="text-xs text-muted-foreground">
                    {userType === 'workspace_owner' 
                      ? 'Workspace owners will have admin privileges in their organization'
                      : 'Guests will have limited access to the organization'}
                  </p>
                )}
              </div>
            )}

            {/* Role field - hidden for Customer Success users and Workspace Owners when creating new members */}
            {!isCustomerSuccess && !isWorkspaceOwner && (
              <div className="grid gap-token-sm">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-sm text-destructive">{errors.role}</p>
                )}
                {userType === 'workspace_owner' && role !== 'client' && (
                  <p className="text-xs text-amber-600">
                    Workspace owners typically have the "Client" role
                  </p>
                )}
              </div>
            )}

            {/* Show auto-assigned role for Customer Success users and Workspace Owners */}
            {(isCustomerSuccess || isWorkspaceOwner) && !member && role && (
              <div className="grid gap-token-sm">
                <Label>Role (Auto-assigned)</Label>
                <div className="px-3 py-2 bg-muted rounded-md text-sm">
                  {roleOptions.find(opt => opt.value === role)?.label}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isWorkspaceOwner 
                    ? 'All invited users are automatically assigned the "Client" role'
                    : 'Role is automatically assigned based on user type'}
                </p>
              </div>
            )}

            {/* Organization field - only for platform admins and customer success (not workspace owners) */}
            {(permissions.isPlatformAdmin || isCustomerSuccess) && (
              <div className="grid gap-token-sm">
                <Label htmlFor="organization">Organization</Label>
                <Select value={organizationId} onValueChange={setOrganizationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} ({org.organization_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.organizationId && (
                  <p className="text-sm text-destructive">{errors.organizationId}</p>
                )}
                {userType === 'workspace_owner' && (
                  <p className="text-xs text-muted-foreground">
                    The selected organization will be owned by this user
                  </p>
                )}
              </div>
            )}

            {/* Show current organization for workspace owners (read-only) */}
            {isWorkspaceOwner && !member && organizations.length > 0 && (
              <div className="grid gap-token-sm">
                <Label>Organization</Label>
                <div className="px-3 py-2 bg-muted rounded-md text-sm">
                  {organizations.find(org => org.owner_id === null)?.name || organizations[0]?.name}
                </div>
                <p className="text-xs text-muted-foreground">
                  Users will be invited to your organization
                </p>
              </div>
            )}

            {/* Status field - only when editing */}
            {member && (
              <div className="grid gap-token-sm">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {member.user_status === 'invited' && member.invite_expires_at && (
                  <p className="text-xs text-muted-foreground">
                    Invitation expires: {new Date(member.invite_expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Processing...' : (member ? 'Update Member' : 'Send Invitation')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
