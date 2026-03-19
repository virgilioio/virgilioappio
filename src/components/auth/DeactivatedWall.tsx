import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldOff, Mail } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function DeactivatedWall() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldOff className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl" withPeriod={false}>
            Your account has been deactivated
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            Contact your administrator to regain access to this platform.
          </p>
          {user?.email && (
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center justify-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{user.email}</span>
              </div>
            </div>
          )}
          <Button variant="outline" className="w-full" onClick={logout}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
