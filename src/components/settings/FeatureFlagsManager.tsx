import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, Flag, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useUpdateFeatureFlag } from '@/hooks/useUpdateFeatureFlag'

export function FeatureFlagsManager() {
  const { data: flags, isLoading, error } = useFeatureFlags()
  const updateFeatureFlag = useUpdateFeatureFlag()
  const [pendingChange, setPendingChange] = useState<{ flagName: string; newValue: boolean } | null>(null)

  const handleToggleFlag = (flagName: string, currentValue: boolean) => {
    const newValue = !currentValue
    
    // For critical flags, show confirmation dialog
    if (flagName === 'self_serve_admin_enabled') {
      setPendingChange({ flagName, newValue })
    } else {
      // For non-critical flags, update immediately
      updateFeatureFlag.mutate({ flagName, isActive: newValue })
    }
  }

  const confirmToggle = () => {
    if (pendingChange) {
      updateFeatureFlag.mutate({
        flagName: pendingChange.flagName,
        isActive: pendingChange.newValue
      })
      setPendingChange(null)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading feature flags...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load feature flags</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Feature Flags Management
          </CardTitle>
          <CardDescription>
            Control platform-wide feature availability. Changes take effect immediately across all sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {flags && flags.length > 0 ? (
              flags.map((flag) => (
                <div
                  key={flag.flag_name}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{flag.flag_name}</h3>
                      <Badge 
                        variant={flag.is_active ? 'default' : 'secondary'}
                        className="flex items-center gap-1"
                      >
                        {flag.is_active ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : null}
                        {flag.is_active ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    {flag.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {flag.description}
                      </p>
                    )}
                    <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                      <span>Created: {new Date(flag.created_at).toLocaleDateString()}</span>
                      <span>Updated: {new Date(flag.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Switch
                    checked={flag.is_active}
                    onCheckedChange={() => handleToggleFlag(flag.flag_name, flag.is_active)}
                    disabled={updateFeatureFlag.isPending}
                  />
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Flag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No feature flags found</p>
                <p className="text-sm text-muted-foreground">
                  Feature flags will appear here when they are created
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog for Critical Flags */}
      <AlertDialog open={!!pendingChange} onOpenChange={() => setPendingChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Feature Flag Change
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange && (
                <>
                  You are about to <strong>{pendingChange.newValue ? 'enable' : 'disable'}</strong> the{' '}
                  <strong>{pendingChange.flagName}</strong> feature flag.
                  {pendingChange.flagName === 'self_serve_admin_enabled' && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded">
                      <p className="text-sm">
                        This controls access to the Customer Management SaaS section. 
                        {pendingChange.newValue 
                          ? ' Enabling this will allow platform administrators to manage SaaS customers.'
                          : ' Disabling this will hide the Customer Management section.'
                        }
                      </p>
                    </div>
                  )}
                  <br />
                  <br />
                  This change will take effect immediately across all sessions. Are you sure?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle}>
              {pendingChange?.newValue ? 'Enable' : 'Disable'} Flag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}