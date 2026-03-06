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
import { SeatLimitUpgradeDialog } from "./SeatLimitUpgradeDialog"
import { useBillingStatus } from "@/hooks/useBillingStatus"

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
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [seatLimitInfo, setSeatLimitInfo] = useState<{
    currentSeats: number
    seatLimit: number | null
    isTrial: boolean
  } | null>(null)
  
  const { organizationId } = useAuth()
  const permissions = usePermissions()
  const { toast } = useToast()
  const { data: billing } = useBillingStatus()
  
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
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
    
    if (permissions.isPlatformAdmin || permissions.isWorkspaceOwner) {
      roles.push(
        { value: 'admin', label: 'Admin', description: 'Full organization management access' },
        { value: 'member', label: 'Member', description: 'Can be assigned to jobs as recruiter, hiring manager, or interviewer' }
      )
    } else if (permissions.isAdmin) {
      // Admin members cannot create other admins
      roles.push(
        { value: 'member', label: 'Member', description: 'Can be assigned to jobs as recruiter, hiring manager, or interviewer' }
      )
    }
    
    return roles
  }

  const onFormSubmit = async (data: FormData) => {
    try {
      const inviteData = {
        email: data.email.trim(),
        system_role: data.role as 'admin' | 'member',
        member_role: data.role === 'admin' ? 'admin' : 'recruiter', // legacy compat
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
      
      // Check if it's a seat limit error
      try {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorData = JSON.parse(errorMessage)
        
        if (errorData.type === 'SEAT_LIMIT_REACHED') {
          setSeatLimitInfo({
            currentSeats: errorData.current_seats,
            seatLimit: errorData.seat_limit,
            isTrial: errorData.is_trial,
          })
          setShowUpgradeDialog(true)
          return
        }
      } catch {
        // Not a JSON error, show generic error
      }
      
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
      <>
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
                    This invitation link will expire in 7 days
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

        {/* Seat Limit Upgrade Dialog */}
        <SeatLimitUpgradeDialog
          open={showUpgradeDialog}
          onOpenChange={setShowUpgradeDialog}
          currentTier={billing?.subscription_tier as 'solo' | 'launch' | 'growth' | 'business' | null}
          currentSeats={seatLimitInfo?.currentSeats ?? 0}
          seatLimit={seatLimitInfo?.seatLimit ?? null}
        />
      </>
    )
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="sm:max-w-[540px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-h4-mobile font-poppins font-bold text-virgilio-text tracking-page-title">
              Invite New User<span className="text-purple-period">.</span>
            </SheetTitle>
            <SheetDescription className="text-virgilio-muted">
              Send an invitation to join your organization. The invited user will be added to your current organization context.
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto pr-2">
            <form id="invite-form" onSubmit={handleSubmit(onFormSubmit)} className="space-y-6 py-6">
              {/* Email field */}
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  {...register("email", { required: true })}
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">Email is required</p>
                )}
              </div>

              {/* Role field */}
              <div className="space-y-2">
                <Label htmlFor="role">
                  Role <span className="text-destructive">*</span>
                </Label>
                <Select
                  onValueChange={(value) => setValue('role', value)}
                  value={selectedRole || ""}
                  disabled={isLoading}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-sm text-destructive">Role is required</p>
                )}
              </div>

              {/* Billing impact alert */}
              {selectedRole && seatsPreview.willIncreaseBilling && (
                <Alert>
                  <DollarSign className="h-4 w-4" />
                  <AlertDescription>
                    <div className="text-sm">
                      <span className="font-medium">Billing impact:</span> Adding this {selectedRoleInfo?.label} will increase your subscription
                      <div className="mt-1 text-xs">
                        • Monthly: +{formatPrice(seatsPreview.monthlyCostIncrease / 100)} (total: {seatsPreview.newSeats} seats)
                        <br />
                        • Yearly: +{formatPrice(seatsPreview.yearlyCostIncrease / 100)} (total: {seatsPreview.newSeats} seats)
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

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
            </form>
          </div>

          <SheetFooter className="border-t pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              form="invite-form"
              disabled={isLoading || !selectedRole}
            >
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Seat Limit Upgrade Dialog */}
      <SeatLimitUpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        currentTier={billing?.subscription_tier as 'solo' | 'launch' | 'growth' | 'business' | null}
        currentSeats={seatLimitInfo?.currentSeats ?? 0}
        seatLimit={seatLimitInfo?.seatLimit ?? null}
      />
    </>
  )
}