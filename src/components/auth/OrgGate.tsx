
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Mail } from 'lucide-react'

interface OrgGateProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function OrgGate({ children, fallback }: OrgGateProps) {
  const { hasOrganizationContext, isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!hasOrganizationContext) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle className="text-xl">Organization Access Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Your account is missing organization context. You need to be assigned to an organization to access this platform.
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center justify-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                <span className="font-medium">{user?.email}</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Next Steps:</strong>
              </p>
              <ul className="space-y-1 text-left">
                <li>• Contact your administrator to assign you to an organization</li>
                <li>• Wait for an invitation to join an existing workspace</li>
                <li>• Contact support if you believe this is an error</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
