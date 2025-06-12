import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'
import { CreateDevAdmin } from '@/components/dev/CreateDevAdmin'
import { useAuth } from '@/contexts/AuthContext'
import { Shield } from 'lucide-react'

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
        // Successful login - redirect to dashboard
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-token-md">
          <div className="h-8 w-8 rounded-full bg-primary animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Section className="min-h-screen flex items-center">
        <AppContainer>
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Login Form */}
              <div className="space-y-token-xl">
                {/* Logo */}
                <div className="text-center space-y-token-md">
                  <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center mx-auto">
                    <Shield className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">Welcome to Virgilio.io</h1>
                    <p className="text-muted-foreground">Sign in to your account</p>
                  </div>
                </div>

                {/* Login Form */}
                <Card>
                  <CardHeader>
                    <CardTitle>Sign In</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-token-lg">
                      <div className="space-y-token-sm">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email"
                          required
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="space-y-token-sm">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          required
                          disabled={isSubmitting}
                        />
                      </div>

                      {error && (
                        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-token-sm">
                          {error}
                        </div>
                      )}

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Signing in...' : 'Sign In'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Development Admin Setup */}
              <div className="space-y-token-xl">
                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-2">Development Setup</h2>
                  <p className="text-muted-foreground text-sm">
                    Quick setup for testing and development
                  </p>
                </div>
                <CreateDevAdmin />
              </div>
            </div>
          </div>
        </AppContainer>
      </Section>
    </div>
  )
}
