
import { AuthGate } from '@/components/auth/AuthGate'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Mail, Shield } from 'lucide-react'

export default function Settings() {
  const { user } = useAuth()

  return (
    <AuthGate>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-layout-lg px-layout-sm sm:px-layout-md lg:px-layout-lg">
          <div className="mb-layout-lg">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">Settings</h1>
            <p className="text-text-secondary mt-sm">
              Manage your account settings and preferences
            </p>
          </div>

          <div className="grid gap-layout-md max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Your account details and role information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-md">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Email:</span>
                  <span className="text-sm text-muted-foreground">{user?.email}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">User Type:</span>
                  <Badge variant="secondary">
                    {user?.user_metadata?.user_type || 'guest'}
                  </Badge>
                </div>
                
                {user?.user_metadata?.member_role && (
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Role:</span>
                    <Badge variant="outline">
                      {user.user_metadata.member_role}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>
                  Customize your experience (coming soon)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Theme preferences, notifications, and other settings will be available here.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AuthGate>
  )
}
