
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, MailX, RefreshCw } from "lucide-react";
import { Member } from "@/hooks/useMembers";

interface PendingInvitationsAlertProps {
  members: Member[];
  onResendInvitation: (memberId: string, email: string) => Promise<void>;
  isLoading: boolean;
}

export function PendingInvitationsAlert({ 
  members, 
  onResendInvitation,
  isLoading 
}: PendingInvitationsAlertProps) {
  // Filter for invited members
  const pendingMembers = members.filter(m => m.user_status === 'invited');
  
  // Check for expiring invitations (within 2 days)
  const expiringSoon = pendingMembers.filter(m => {
    if (!m.invite_expires_at) return false;
    const expiresAt = new Date(m.invite_expires_at);
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    return expiresAt < twoDaysFromNow && expiresAt > new Date();
  });

  // Check for expired invitations
  const expiredInvites = pendingMembers.filter(m => {
    if (!m.invite_expires_at) return false;
    return new Date(m.invite_expires_at) < new Date();
  });

  // Check for failed email deliveries
  const failedEmails = pendingMembers.filter(m => 
    m.invitation_email_status === 'failed' || m.invitation_email_status === 'bounced'
  );

  // No issues to show
  if (pendingMembers.length === 0 && failedEmails.length === 0) return null;
  
  // Show info if there are pending but no issues
  const hasIssues = expiringSoon.length > 0 || expiredInvites.length > 0 || failedEmails.length > 0;
  
  if (!hasIssues && pendingMembers.length === 0) return null;

  const handleResendAll = async () => {
    const membersToResend = [...failedEmails, ...expiredInvites];
    for (const member of membersToResend) {
      const email = member.user_email || member.invited_email;
      if (email) {
        try {
          await onResendInvitation(member.id, email);
        } catch (error) {
          console.error(`Failed to resend invitation to ${email}:`, error);
        }
      }
    }
  };

  return (
    <Alert 
      variant={hasIssues ? "destructive" : "default"} 
      className={hasIssues ? "mb-4 border-warning/50 bg-warning/10" : "mb-4"}
    >
      {hasIssues ? (
        <AlertTriangle className="h-4 w-4 text-warning" />
      ) : (
        <Clock className="h-4 w-4" />
      )}
      <AlertTitle className="flex items-center gap-2">
        Pending Invitations ({pendingMembers.length})
        {hasIssues && (
          <span className="text-sm font-normal text-muted-foreground">
            — Action required
          </span>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="flex flex-wrap gap-3 text-sm">
          {expiredInvites.length > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <Clock className="h-3.5 w-3.5" />
              {expiredInvites.length} expired
            </span>
          )}
          {expiringSoon.length > 0 && (
            <span className="flex items-center gap-1 text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              {expiringSoon.length} expiring soon
            </span>
          )}
          {failedEmails.length > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <MailX className="h-3.5 w-3.5" />
              {failedEmails.length} email{failedEmails.length > 1 ? 's' : ''} failed
            </span>
          )}
        </div>
        
        {(failedEmails.length > 0 || expiredInvites.length > 0) && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleResendAll}
            disabled={isLoading}
            className="mt-3 gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Resend {failedEmails.length + expiredInvites.length} Invitation{(failedEmails.length + expiredInvites.length) > 1 ? 's' : ''}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
