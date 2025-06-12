
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { VirgilioLogo } from '@/components/VirgilioLogo'
import { useAuth } from '@/contexts/AuthContext'

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const { error } = await login(email, password)
      if (error) {
        setError(error.message)
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/20 to-warning/10 flex items-center justify-center">
        <div className="text-center space-y-token-md">
          <div className="h-8 w-8 rounded-full bg-primary animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Invisible Header - Fixed positioned to match main header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="mx-auto max-w-7xl px-layout-sm sm:px-layout-md lg:px-layout-lg">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="hover:scale-105 transition-transform duration-default">
                <VirgilioLogo size="sm" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Left Side - 70% with #fffead background */}
      <div className="w-[70%] relative overflow-hidden" style={{ backgroundColor: '#fffead' }}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-primary"></div>
          <div className="absolute top-40 right-32 w-24 h-24 rounded-full bg-accent"></div>
          <div className="absolute bottom-32 left-32 w-40 h-40 rounded-full bg-warning"></div>
          <div className="absolute bottom-20 right-20 w-28 h-28 rounded-full bg-success"></div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="text-center max-w-md px-8">
            <div className="mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl">
                <div className="text-4xl">🚀</div>
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Connect talent with opportunity
              </h2>
              <p className="text-lg text-muted-foreground">
                Virgilio.io helps you find and manage the best talent for your organization
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-surface-primary/80 backdrop-blur-sm rounded-lg p-4 border border-border/20">
                <div className="text-2xl mb-2">📊</div>
                <div className="font-medium text-foreground">Analytics</div>
                <div className="text-muted-foreground">Detailed insights</div>
              </div>
              <div className="bg-surface-primary/80 backdrop-blur-sm rounded-lg p-4 border border-border/20">
                <div className="text-2xl mb-2">🔒</div>
                <div className="font-medium text-foreground">Security</div>
                <div className="text-muted-foreground">Protected data</div>
              </div>
              <div className="bg-surface-primary/80 backdrop-blur-sm rounded-lg p-4 border border-border/20">
                <div className="text-2xl mb-2">⚡</div>
                <div className="font-medium text-foreground">Speed</div>
                <div className="text-muted-foreground">Agile processes</div>
              </div>
              <div className="bg-surface-primary/80 backdrop-blur-sm rounded-lg p-4 border border-border/20">
                <div className="text-2xl mb-2">🎯</div>
                <div className="font-medium text-foreground">Precision</div>
                <div className="text-muted-foreground">Perfect matches</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - 30% white background with login form */}
      <div className="w-[30%] bg-white flex flex-col justify-center px-8 xl:px-12">
        {/* Welcome Text */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Welcome back
          </h1>
          <p className="text-lg text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>

        {/* Login Form */}
        <Card className="border-0 shadow-none bg-transparent p-0">
          <CardContent className="p-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={isSubmitting}
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={isSubmitting}
                  className="h-12 text-base"
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-medium"
                disabled={isSubmitting}
                size="lg"
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
