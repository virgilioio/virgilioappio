import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Mail, RefreshCw, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'

interface PendingInvitation {
  organization_name: string
  system_role: string
  invited_by_email?: string
  invite_expires_at: string
  member_id: string
}

interface PendingInvitationAlertProps {
  invitation: PendingInvitation
  userEmail: string
}

export function PendingInvitationAlert({ invitation, userEmail }: PendingInvitationAlertProps) {
  const [isRequesting, setIsRequesting] = useState(false)

  const isExpired = new Date(invitation.invite_expires_at) < new Date()

  const handleRequestNewInvite = async () => {
    setIsRequesting(true)
    try {
      // Call the resend invitation endpoint
      const { error } = await supabase.functions.invoke('resend-invitation', {
        body: { 
          memberId: invitation.member_id,
          email: userEmail
        }
      })

      if (error) throw error

      toast({
        title: 'Invitation Request Sent',
        description: 'A new invitation link will be sent to your email shortly.'
      })
    } catch (error) {
      console.error('Error requesting new invitation:', error)
      toast({
        title: 'Request Failed',
        description: 'Please contact the workspace administrator directly.',
        variant: 'destructive'
      })
    } finally {
      setIsRequesting(false)
    }
  }

  return (
    <Alert className="bg-accent/10 border-accent/30 mb-6">
      <Building2 className="h-5 w-5 text-accent" />
      <AlertTitle className="text-foreground font-semibold">
        You have a pending invitation
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-muted-foreground">
          You've been invited to join <strong className="text-foreground">{invitation.organization_name}</strong> as a{' '}
          <strong className="text-foreground">{invitation.member_role.replace('_', ' ')}</strong>.
        </p>
        
        {isExpired ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive font-medium">
              This invitation has expired.
            </p>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleRequestNewInvite}
              disabled={isRequesting}
              className="gap-2"
            >
              {isRequesting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Request New Invitation
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Please check your email for the invitation link, or contact your workspace administrator.
          </p>
        )}

        {invitation.invited_by_email && (
          <p className="text-xs text-muted-foreground">
            Invited by: {invitation.invited_by_email}
          </p>
        )}
      </AlertDescription>
    </Alert>
  )
}
