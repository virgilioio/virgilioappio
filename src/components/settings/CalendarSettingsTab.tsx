import { Calendar, AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useCalendarIdentities } from '@/hooks/useCalendarIdentities';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

export default function CalendarSettingsTab() {
  const { user } = useAuth();
  const {
    identities,
    isLoading,
    connectGoogleCalendar,
    disconnectCalendar,
    isDisconnecting,
    testConnection,
    isTesting,
  } = useCalendarIdentities();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Calendar Integration</h2>
          <p className="text-muted-foreground">
            Connect your calendar to manage interview availability.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Healthy
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Calendar Integration</h2>
        <p className="text-muted-foreground">
          Connect your Google Calendar to show real-time availability when candidates book interviews.
        </p>
      </div>

      {identities.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>No Calendar Connected</CardTitle>
            <CardDescription>
              Connect your Google Calendar to enable interview scheduling with real-time availability.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <Button onClick={connectGoogleCalendar} size="lg">
              <Calendar className="h-4 w-4 mr-2" />
              Connect Google Calendar
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              We'll request read-only access to check your availability.
              <br />
              Your calendar events remain private.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {identities.map((identity) => (
            <Card key={identity.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{identity.email_address}</CardTitle>
                      {identity.display_name && (
                        <CardDescription>{identity.display_name}</CardDescription>
                      )}
                    </div>
                  </div>
                  {getSyncStatusBadge(identity.sync_status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Provider</p>
                    <p className="font-medium capitalize">{identity.provider}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Synced</p>
                    <p className="font-medium">
                      {identity.last_sync_at
                        ? formatDistanceToNow(new Date(identity.last_sync_at), { addSuffix: true })
                        : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Token Expires</p>
                    <p className="font-medium">
                      {formatDistanceToNow(new Date(identity.token_expires_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {identity.sync_error_message && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{identity.sync_error_message}</AlertDescription>
                  </Alert>
                )}

                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => user && testConnection(user.id)}
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>

                  {identity.sync_status === 'expired' && (
                    <Button onClick={connectGoogleCalendar}>Reconnect</Button>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={isDisconnecting}>
                        Disconnect
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Calendar</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to disconnect {identity.email_address}? This will
                          disable real-time availability checking for interview scheduling.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => disconnectCalendar(identity.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button onClick={connectGoogleCalendar} variant="outline" className="w-full">
            <Calendar className="h-4 w-4 mr-2" />
            Connect Another Calendar
          </Button>
        </div>
      )}
    </div>
  );
}
