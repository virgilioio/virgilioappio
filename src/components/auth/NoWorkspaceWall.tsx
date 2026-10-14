import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail, UserPlus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Gio is invite-only (2026-10-14). Someone signed in without a workspace
 * used to land in onboarding, which created a new one; now they see this.
 */
export function NoWorkspaceWall() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <UserPlus className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl" withPeriod={false}>
            You're not in a Gio workspace yet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            Gio is invite-only. Ask an admin at Virgilio to invite you, then open the link in that email.
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
