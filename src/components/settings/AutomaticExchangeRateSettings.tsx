
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Clock, Activity, AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { useAutomaticExchangeRates } from '@/hooks/useAutomaticExchangeRates'
import { usePermissions } from '@/hooks/usePermissions'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function AutomaticExchangeRateSettings() {
  const { isPlatformAdmin } = usePermissions()
  const {
    cronStatus,
    updateLogs,
    isLoading,
    isManaging,
    manageCronJob,
    refetchStatus,
    refetchLogs
  } = useAutomaticExchangeRates()

  if (!isPlatformAdmin) {
    return null
  }

  const handleToggleAutomaticUpdates = async (enabled: boolean) => {
    await manageCronJob(enabled)
  }

  const handleRefresh = async () => {
    await Promise.all([refetchStatus(), refetchLogs()])
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'pending':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Automatic Updates
          </CardTitle>
          <Button
            onClick={handleRefresh}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Automatic Updates */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="auto-updates" className="text-sm font-medium">
              Enable Automatic Updates
            </Label>
            <p className="text-sm text-muted-foreground">
              Exchange rates will be updated daily at 2:00 AM UTC
            </p>
          </div>
          <Switch
            id="auto-updates"
            checked={cronStatus?.is_enabled || false}
            onCheckedChange={handleToggleAutomaticUpdates}
            disabled={isLoading || isManaging}
          />
        </div>

        <Separator />

        {/* Status Information */}
        {cronStatus && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <div className="flex items-center gap-2">
                  <Badge variant={cronStatus.is_enabled ? 'default' : 'secondary'}>
                    {cronStatus.is_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  {cronStatus.is_enabled && cronStatus.next_run && (
                    <span className="text-sm text-muted-foreground">
                      Next run: {new Date(cronStatus.next_run).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {cronStatus.last_automatic_update && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Last Automatic Update</Label>
                  <div className="flex items-center gap-2">
                    {cronStatus.last_update_status && getStatusIcon(cronStatus.last_update_status)}
                    <span className="text-sm text-muted-foreground">
                      {new Date(cronStatus.last_automatic_update).toLocaleString()}
                    </span>
                    {cronStatus.last_update_status && (
                      <Badge className={getStatusColor(cronStatus.last_update_status)}>
                        {cronStatus.last_update_status}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Update Logs */}
        {updateLogs.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Recent Update Activity
              </Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {updateLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(log.status)}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {log.update_type}
                          </Badge>
                          <Badge className={getStatusColor(log.status)}>
                            {log.status}
                          </Badge>
                        </div>
                        {log.message && (
                          <p className="text-sm text-muted-foreground">{log.message}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Information Alert */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Automatic updates will fetch the latest exchange rates for all supported currencies used by active organizations. 
            The system will automatically handle rate conversions and triangulation when direct rates are not available.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
