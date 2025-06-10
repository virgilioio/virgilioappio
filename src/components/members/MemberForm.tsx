
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
  const [organizationId, setOrganizationId] = useState<string>("")
  const [status, setStatus] = useState<string>("invited")
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const { organizations } = useOrganizations()
  const permissions = usePermissions()

  useEffect(() => {
    if (member) {
      setEmail(member.user_email || "")
      setRole(member.member_role)
      setOrganizationId(member.organization_id)
      setStatus(member.user_status)
    } else {
      setEmail("")
      setRole("")
      setOrganizationId("")
      setStatus("invited")
    }
    setErrors({})
  }, [member, isOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!member && !email.trim()) {
      newErrors.email = "Email is required"
    } else if (!member && email && !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email"
    }

    if (!role) {
      newErrors.role = "Role is required"
    }

    if (!organizationId && permissions.isPlatformAdmin) {
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
      }

      if (!member) {
        // Creating new member (invitation)
        data.user_id = null // Will be set when user accepts invitation
        if (permissions.isPlatformAdmin) {
          data.organization_id = organizationId
        } else {
          // For workspace owners, use their organization
          const userOrg = organizations.find(org => org.owner_id === null) // This logic needs to be improved
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
  ]

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
            {member ? 'Edit Member' : 'Invite New Member'}
          </DialogTitle>
          <DialogDescription>
            {member 
              ? 'Update member role and status.'
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
              </div>
            )}

            {/* Role field */}
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
            </div>

            {/* Organization field - only for platform admins */}
            {permissions.isPlatformAdmin && (
              <div className="grid gap-token-sm">
                <Label htmlFor="organization">Organization</Label>
                <Select value={organizationId} onValueChange={setOrganizationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.organizationId && (
                  <p className="text-sm text-destructive">{errors.organizationId}</p>
                )}
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
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : (member ? 'Update Member' : 'Send Invitation')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
