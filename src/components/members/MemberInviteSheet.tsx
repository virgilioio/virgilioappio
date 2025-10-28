import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useForm } from "react-hook-form"
import { useAuth } from "@/contexts/AuthContext"
import { usePermissions } from "@/hooks/usePermissions"
import { Member } from "@/hooks/useMembers"
import { Check, Copy, ExternalLink, DollarSign, Info } from "lucide-react"
import { copyToClipboard } from "@/utils/clipboard"
import { useToast } from "@/hooks/use-toast"
import { useSeatsPreview } from "@/hooks/useSeatsPreview"
import { formatPrice } from "@/utils/pricing"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface MemberInviteSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => Promise<any>
  member?: Member | null
  isLoading: boolean
}

interface FormData {
  email: string
  role: string
}

export function MemberInviteSheet({ 
  isOpen, 
  onClose, 
  onSubmit, 
  member,
  isLoading 
}: MemberInviteSheetProps) {
  const [inviteUrl, setInviteUrl] = useState<string>("")
  const [showInviteUrl, setShowInviteUrl] = useState(false)
  const [invitedEmail, setInvitedEmail] = useState<string>("")
  
  const { organizationId } = useAuth()
  const permissions = usePermissions()
  const { toast } = useToast()
  
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<FormData>({
    defaultValues: {
      email: "",
      role: ""
    }
  })

  const selectedRole = watch("role")
  const seatsPreview = useSeatsPreview(selectedRole as any)

  useEffect(() => {
    if (!isOpen) {
      reset()
      setInviteUrl("")
      setShowInviteUrl(false)
      setInvitedEmail("")
    }
  }, [isOpen, reset])

  const getRoleOptions = () => {
    const roles = []
    
    if (permissions.isPlatformAdmin) {
      // Platform admins can assign any role
      roles.push(
        { value: 'admin', label: 'Admin', description: 'Full organization management access' },
        { value: 'recruiter', label: 'Recruiter', description: 'Can manage jobs, candidates, and team assignments' },
        { value: 'hiring_manager', label: 'Hiring Manager', description: 'Can view and manage assigned jobs' },
        { value: 'interviewer', label: 'Interviewer', description: 'Limited access for conducting interviews' }
      )
    } else if (permissions.isWorkspaceOwner) {
      // Workspace owners can assign any role
      roles.push(
        { value: 'admin', label: 'Admin', description: 'Full organization management access' },
        { value: 'recruiter', label: 'Recruiter', description: 'Can manage jobs, candidates, and team assignments' },
        { value: 'hiring_manager', label: 'Hiring Manager', description: 'Can view and manage assigned jobs' },
        { value: 'interviewer', label: 'Interviewer', description: 'Limited access for conducting interviews' }
      )
    } else if (permissions.isAdmin) {
      // Admin members cannot create other admins
      roles.push(
        { value: 'recruiter', label: 'Recruiter', description: 'Can manage jobs, candidates, and team assignments' },
        { value: 'hiring_manager', label: 'Hiring Manager', description: 'Can view and manage assigned jobs' },
        { value: 'interviewer', label: 'Interviewer', description: 'Limited access for conducting interviews' }
      )
    }
    
    return roles
  }

  const onFormSubmit = async (data: FormData) => {
    try {
      const inviteData = {
        email: data.email.trim(),
        member_role: data.role,
        user_type: 'member', // Always default to member
        organization_id: organizationId, // Use current user's organization
        user_status: 'invited'
      }

      const result = await onSubmit(inviteData)
      
      if (result?.inviteUrl) {
        setInviteUrl(result.inviteUrl)
        setInvitedEmail(data.email)
        setShowInviteUrl(true)
      } else {
        onClose()
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      toast({
        title: "Error",
        description: "Failed to send invitation. Please try again.",
        variant: "destructive"
      })
    }
  }

  const roleOptions = getRoleOptions()
  const selectedRoleInfo = roleOptions.find(r => r.value === selectedRole)

  if (showInviteUrl) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="sm:max-w-[540px]">
          <SheetHeader>
            <SheetTitle className="text-h4-mobile font-poppins font-bold text-virgilio-text tracking-page-title">
              Invitation Sent<span className="text-purple-period">.</span>
            </SheetTitle>
            <SheetDescription className="text-virgilio-muted">
              The invitation has been sent via email. You can also copy the link below to share directly.
            </SheetDescription>
          </SheetHeader>
          
          <div className="py-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-green-600" />
                <span>Invitation sent to {invitedEmail}</span>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="invite-url">Invitation Link</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="invite-url"
                    value={inviteUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(inviteUrl, 'Invitation link copied!')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link directly with the invited user or they can use the email invitation
                </p>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <ExternalLink className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-700">
                  The user can also access this link from their email invitation
                </span>
              </div>
            </div>
          </div>

          <SheetFooter>
            <Button onClick={onClose} className="w-full">
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[540px]">
        <SheetHeader>
          <SheetTitle className="text-h4-mobile font-poppins font-bold text-virgilio-text tracking-page-title">
            Invite New User<span className="text-purple-period">.</span>
          </SheetTitle>
          <SheetDescription className="text-virgilio-muted">
            Send an invitation to join your organization. The invited user will be added to your current organization context.
          </SheetDescription>
        </SheetHeader>
        
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6 py-6">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter email address"
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /\S+@\S+\.\S+/,
                  message: "Please enter a valid email"
                }
              })}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              An invitation email will be sent to this address
            </p>
          </div>

          {/* Role Field */}
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select 
              value={selectedRole || ""} 
              onValueChange={(value) => {
                // Update the form value manually since react-hook-form doesn't handle this automatically
                reset({ 
                  email: watch("email"), 
                  role: value 
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedRole && (
              <p className="text-sm text-destructive">Role is required</p>
            )}
            {selectedRoleInfo && (
              <p className="text-xs text-muted-foreground">
                {selectedRoleInfo.description}
              </p>
            )}
            <input
              type="hidden"
              {...register("role", { required: "Role is required" })}
            />
          </div>

          {/* Billing Impact Alert */}
          {selectedRole && seatsPreview.willIncreaseBilling && (
            <Alert>
              <DollarSign className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">Billing Impact</div>
                <div className="text-sm text-muted-foreground">
                  Adding this member will increase your seat count from {seatsPreview.currentSeats} to {seatsPreview.newSeats} 
                  (+{formatPrice(seatsPreview.monthlyCostIncrease)}/month or +{formatPrice(seatsPreview.yearlyCostIncrease)}/year)
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Free Role Info */}
          {selectedRole && seatsPreview.isFreeTier && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="text-sm">
                  <span className="font-medium">Free role:</span> Hiring Managers and Interviewers don't affect billing
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Organization Context Info */}
          <div className="p-3 bg-muted rounded-md">
            <div className="text-sm font-medium">Organization</div>
            <div className="text-sm text-muted-foreground">
              User will be invited to your current organization
            </div>
          </div>
        </form>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading || !selectedRole}
            onClick={handleSubmit(onFormSubmit)}
          >
            {isLoading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}