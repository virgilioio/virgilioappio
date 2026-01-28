
import { useState } from 'react'
import { Navigate, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoGioLogo } from '@/components/GoGioLogo'

import { GoogleLogo } from '@/components/icons/GoogleLogo'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)

  // Get redirect parameter if present (for Chrome OAuth flow, etc.)
  const redirectTo = searchParams.get('redirect')

  // Redirect authenticated users - use redirect param if valid, otherwise dashboard
  if (isAuthenticated && !isLoading) {
    const destination = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard'
    return <Navigate to={destination} replace />
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
        // Navigate to redirect target or dashboard - RequireAuth will handle org context routing
        const destination = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard'
        navigate(destination)
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#fffcf9' }}>
      {/* Centered content */}
      <div className="w-full flex flex-col justify-center items-center px-6 sm:px-8 lg:px-8 xl:px-12 min-h-screen">
        {/* Logo and tagline - outside the card */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <GoGioLogo size="xl" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-2" style={{ fontFamily: 'Poppins', letterSpacing: '-0.06em' }}>
            Find your people<span style={{ color: '#7c3aed' }}>.</span>
          </h1>
        </div>

        {/* Card wrapper for form */}
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
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
                      const { data, error } = await supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                          redirectTo: `${window.location.origin}/auth/callback`
                        }
                      })
                      
                      if (error) {
                        setError(error.message)
                        setIsGoogleSubmitting(false)
                        return
                      }
                      
                      if (data?.url) {
                        if (import.meta.env.DEV) console.debug('[Google OAuth] Redirecting to:', data.url)
                        window.location.assign(data.url)
                      } else {
                        setError('Failed to initiate Google sign-in')
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
          </div>

          <footer className="mt-6 text-xs text-foreground/70 text-center">
            <nav className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/privacy" className="underline underline-offset-2 hover:no-underline">Privacy Policy</Link>
              <span aria-hidden="true">•</span>
              <Link to="/terms" className="underline underline-offset-2 hover:no-underline">Terms of Service</Link>
            </nav>
            <p className="mt-2">© {new Date().getFullYear()} GoGio</p>
          </footer>
        </div>
      </div>
    </div>
  )
}
