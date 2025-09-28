
import { useState } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { VirgilioLogo } from '@/components/VirgilioLogo'
import { TypingAnimation } from '@/components/TypingAnimation'
import { GoogleLogo } from '@/components/icons/GoogleLogo'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'

export default function Login() {
  const { login, isAuthenticated, isLoading, hasOrganizationContext } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to={hasOrganizationContext ? '/dashboard' : '/onboarding'} replace />
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
        // Let the auth guard redirect appropriately once org context is resolved
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
    <div className="min-h-screen flex flex-col lg:flex-row">
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

      {/* Left Side - Responsive width with #fffead background */}
      <div className="w-full lg:w-2/3 xl:w-3/5 2xl:w-2/3 relative overflow-hidden flex items-center justify-center min-h-[50vh] lg:min-h-screen" style={{ backgroundColor: '#fffead' }}>
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <TypingAnimation />
        </div>
      </div>

      {/* Right Side - Responsive width white background with login form */}
      <div className="w-full lg:w-1/3 xl:w-2/5 2xl:w-1/3 bg-white flex flex-col justify-center px-6 sm:px-8 lg:px-8 xl:px-12 min-h-[50vh] lg:min-h-screen">
        {/* Welcome Text */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
            Welcome back
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
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
                <div className="flex justify-between">
                  <Link 
                    to="/forgot-password" 
                    className="text-sm transition-colors"
                    style={{ color: 'rgb(31, 116, 179)' }}
                  >
                    Forgot password?
                  </Link>
                  <Link 
                    to="/signup" 
                    className="text-sm transition-colors"
                    style={{ color: 'rgb(31, 116, 179)' }}
                  >
                    Don't have an account? Sign up
                  </Link>
                </div>
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

              <div className="relative text-center">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-base font-medium hover:!bg-transparent hover:text-[hsl(var(--google-blue))] hover:border-[hsl(var(--google-blue))]"
                disabled={isGoogleSubmitting}
                  onClick={async () => {
                    setError('')
                    setIsGoogleSubmitting(true)
                    try {
                      // Generate simple UUID-based state for OAuth security
                      const state = crypto.randomUUID()
                      sessionStorage.setItem('oauth_state', state)
                      
                      const { error } = await supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                          redirectTo: `${window.location.origin}/auth/callback`
                        }
                      })
                      
                      if (error) {
                        setError(error.message)
                        setIsGoogleSubmitting(false)
                      }
                    } catch (err: any) {
                      setError(err.message || 'Google sign-in failed')
                      setIsGoogleSubmitting(false)
                    }
                  }}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <GoogleLogo className="h-5 w-5" />
                  <span>{isGoogleSubmitting ? 'Redirecting to Google…' : 'Continue with Google'}</span>
                </span>
              </Button>
            </form>
          </CardContent>
        </Card>
        <footer className="mt-6 text-xs text-secondary">
          <nav className="flex flex-wrap items-center gap-3">
            <Link to="/privacy" className="underline underline-offset-2 hover:no-underline">Privacy Policy</Link>
            <span aria-hidden="true">•</span>
            <Link to="/terms" className="underline underline-offset-2 hover:no-underline">Terms of Service</Link>
          </nav>
          <p className="mt-2">© {new Date().getFullYear()} Virgilio</p>
        </footer>
      </div>
    </div>
  )
}
