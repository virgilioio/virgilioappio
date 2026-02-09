import { Mail, Trash2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useMailIdentities } from '@/hooks/useMailIdentities';
import { useSyncGmail } from '@/hooks/useSyncGmail';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { GoogleLogo } from '@/components/icons/GoogleLogo';

export function EmailSettingsTab() {
  const { identities, isLoading, connectGmail, disconnectIdentity } = useMailIdentities();
  const syncGmail = useSyncGmail();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Email Accounts</h3>
        <p className="text-sm text-muted-foreground">
          Connect your email accounts to send emails directly from GoGio.
        </p>
      </div>

      <div className="space-y-4">
        {identities.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <GoogleLogo size={48} className="text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                No email accounts connected yet
              </p>
              <Button 
                onClick={() => connectGmail.mutate()}
                disabled={connectGmail.isPending}
              >
                <GoogleLogo size={16} className="mr-2" />
                {connectGmail.isPending ? 'Connecting...' : 'Connect Gmail'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {identities.map((identity) => (
              <Card key={identity.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {identity.email_address}
                      </CardTitle>
                      <CardDescription>
                        {identity.display_name}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {identity.sync_status === 'active' ? (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {identity.sync_status}
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncGmail.mutate(identity.id)}
                        disabled={syncGmail.isPending}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${syncGmail.isPending ? 'animate-spin' : ''}`} />
                        Sync Now
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            disabled={disconnectIdentity.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
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
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Provider: {identity.provider}</p>
                    <p>
                      Last synced: {formatDistanceToNow(new Date(identity.last_sync_at), { addSuffix: true })}
                    </p>
                    <p>
                      Token expires: {formatDistanceToNow(new Date(identity.token_expires_at), { addSuffix: true })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button 
              onClick={() => connectGmail.mutate()}
              disabled={connectGmail.isPending}
              variant="outline"
              className="w-full"
            >
              <GoogleLogo size={16} className="mr-2" />
              {connectGmail.isPending ? 'Connecting...' : 'Connect Another Gmail Account'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
