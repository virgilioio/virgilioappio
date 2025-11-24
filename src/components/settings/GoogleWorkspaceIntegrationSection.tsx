import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, CheckCircle, XCircle } from "lucide-react"
import { GoogleLogo } from "@/components/icons/GoogleLogo"
import { GoogleCalendarLogo } from "@/components/icons/GoogleCalendarLogo"
import { GmailLogo } from "@/components/icons/GmailLogo"
import { useMailIdentities } from "@/hooks/useMailIdentities"
import { useCalendarIdentities } from "@/hooks/useCalendarIdentities"
import { useAuth } from "@/contexts/AuthContext"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useSyncGmail } from "@/hooks/useSyncGmail"

export function GoogleWorkspaceIntegrationSection() {
  const { user } = useAuth()
  const { 
    identities: mailIdentities, 
    isLoading: isLoadingMail, 
    connectGmail, 
    disconnectIdentity: disconnectMail 
  } = useMailIdentities()
  
  const { 
    identities: calendarIdentities, 
    isLoading: isLoadingCalendar, 
    connectGoogleCalendar, 
    disconnectCalendar, 
    isDisconnecting,
    testConnection,
    isTesting 
  } = useCalendarIdentities()
  
  const syncGmail = useSyncGmail()

  const isLoading = isLoadingMail || isLoadingCalendar
  const hasMailConnection = mailIdentities && mailIdentities.length > 0
  const hasCalendarConnection = calendarIdentities && calendarIdentities.length > 0
  const hasAnyConnection = hasMailConnection || hasCalendarConnection

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Google Workspace Integration</h3>
          <p className="text-sm text-muted-foreground">
            Connect your Google account to enable email sending and calendar scheduling.
          </p>
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
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

  const handleDisconnectAll = async () => {
    if (mailIdentities && mailIdentities.length > 0) {
      for (const identity of mailIdentities) {
        await disconnectMail.mutateAsync(identity.id)
      }
    }
    if (calendarIdentities && calendarIdentities.length > 0) {
      for (const identity of calendarIdentities) {
        await disconnectCalendar(identity.id)
      }
    }
  }

  return (
    <div className="space-y-4" data-onboarding-target="google">
      <div>
        <h3 className="text-lg font-semibold mb-1">Google Workspace Integration</h3>
        <p className="text-sm text-muted-foreground">
          Connect your Google account to enable email sending and calendar scheduling.
        </p>
      </div>

      {!hasAnyConnection ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GoogleLogo size={20} />
              No Google Account Connected
            </CardTitle>
            <CardDescription>
              Connect your Google account to unlock email and calendar features. This single connection enables both services.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <GmailLogo className="h-4 w-auto" />
                <span>Send emails directly from the app</span>
              </div>
              <div className="flex items-center gap-2">
                <GoogleCalendarLogo className="h-4 w-auto" />
                <span>Schedule interviews and check availability</span>
              </div>
            </div>
            <Button onClick={() => connectGmail.mutate()} disabled={connectGmail.isPending}>
              {connectGmail.isPending ? "Connecting..." : "Connect Google Workspace"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <GoogleLogo size={20} />
                    Google Workspace Connected
                  </CardTitle>
                  <CardDescription>
                    {mailIdentities?.[0]?.email_address || calendarIdentities?.[0]?.email_address}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {calendarIdentities && calendarIdentities.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnection(user!.id)}
                      disabled={isTesting}
                    >
                      {isTesting ? "Testing..." : "Test Calendar"}
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Disconnect
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Google Workspace</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to disconnect your Google account? 
                          You won't be able to send emails or schedule interviews anymore.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDisconnectAll}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={isDisconnecting || disconnectMail.isPending}
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Gmail Status */}
              {hasMailConnection && mailIdentities && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <GmailLogo className="h-4 w-auto" />
                    Gmail
                  </div>
                  <div className="space-y-2 text-sm pl-6">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      {getSyncStatusBadge(mailIdentities[0].sync_status)}
                    </div>
                    <div className="pt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => syncGmail.mutate(mailIdentities[0].id)}
                        disabled={syncGmail.isPending}
                      >
                        {syncGmail.isPending ? "Syncing..." : "Sync Now"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Google Calendar Status */}
              {hasCalendarConnection && calendarIdentities && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <GoogleCalendarLogo className="h-4 w-auto" />
                    Google Calendar
                  </div>
                  <div className="space-y-2 text-sm pl-6">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      {getSyncStatusBadge(calendarIdentities[0].sync_status || 'healthy')}
                    </div>
                    {calendarIdentities[0].sync_status === 'expired' && (
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={connectGoogleCalendar}
                        >
                          Reconnect Calendar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Missing Service Indicators */}
              {!hasMailConnection && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <GmailLogo className="h-4 w-auto" />
                    Gmail
                  </div>
                  <div className="pl-6">
                    <Badge variant="secondary" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Not Connected
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">
                      Reconnect to enable email features
                    </p>
                  </div>
                </div>
              )}
              
              {!hasCalendarConnection && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <GoogleCalendarLogo className="h-4 w-auto" />
                    Google Calendar
                  </div>
                  <div className="pl-6">
                    <Badge variant="secondary" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Not Connected
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">
                      Reconnect to enable calendar features
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {(!hasMailConnection || !hasCalendarConnection) && (
            <Button 
              onClick={() => connectGmail.mutate()} 
              disabled={connectGmail.isPending}
              variant="outline"
            >
              {connectGmail.isPending ? "Connecting..." : "Reconnect Google Workspace"}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
