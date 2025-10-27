import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Mail, AlertCircle, CheckCircle, XCircle } from "lucide-react"
import { useMailIdentities } from "@/hooks/useMailIdentities"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { formatDistanceToNow } from "date-fns"

export function EmailAccountsSection() {
  const { identities, isLoading, connectGmail, disconnectIdentity } = useMailIdentities()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Email Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Connect your email accounts to send emails directly from Virgilio.
          </p>
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Connected</Badge>
      case 'error':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Error</Badge>
      case 'expired':
        return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Expired</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Email Accounts</h3>
        <p className="text-sm text-muted-foreground">
          Connect your email accounts to send emails directly from Virgilio.
        </p>
      </div>

      {!identities || identities.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              No Email Accounts Connected
            </CardTitle>
            <CardDescription>
              Connect your Gmail account to start sending emails.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => connectGmail.mutate()} disabled={connectGmail.isPending}>
              {connectGmail.isPending ? "Connecting..." : "Connect Gmail"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {identities.map((identity) => (
              <Card key={identity.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{identity.email_address}</CardTitle>
                      <CardDescription>{identity.display_name}</CardDescription>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          Disconnect
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect Email Account</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to disconnect {identity.email_address}? 
                            You won't be able to send emails from this account anymore.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => disconnectIdentity.mutate(identity.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      {getSyncStatusBadge(identity.sync_status)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Provider:</span>
                      <span className="font-medium capitalize">{identity.provider}</span>
                    </div>
                    {identity.last_sync_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Last synced:</span>
                        <span className="font-medium">
                          {formatDistanceToNow(new Date(identity.last_sync_at), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    {identity.token_expires_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Token expires:</span>
                        <span className="font-medium">
                          {formatDistanceToNow(new Date(identity.token_expires_at), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button 
            onClick={() => connectGmail.mutate()} 
            disabled={connectGmail.isPending}
            variant="outline"
          >
            {connectGmail.isPending ? "Connecting..." : "Connect Another Gmail Account"}
          </Button>
        </>
      )}
    </div>
  )
}
