import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { VirgilioLogo } from '@/components/VirgilioLogo'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'validating' | 'success' | 'error'>('validating')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const validateAndProcessAuth = async () => {
      try {
        console.log('Starting auth callback validation...')
        
        // Check for auth session first
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          setStatus('error')
          setErrorMessage('Failed to establish authentication session.')
          return
        }

        if (!session) {
          console.log('No session found, redirecting to auth')
          setStatus('error')
          setErrorMessage('No authentication session found.')
          return
        }

        console.log('Session found, user:', session.user.email)
        setStatus('success')
        
        // Clear any stored state
        sessionStorage.removeItem('oauth_state')
        
        // Navigate to dashboard after short delay - let RequireAuth handle org context
        setTimeout(() => {
          navigate('/dashboard', { replace: true })
        }, 1500)

      } catch (error) {
        console.error('Auth callback error:', error)
        setStatus('error')
        setErrorMessage('An unexpected error occurred during authentication.')
      }
    }

    validateAndProcessAuth()
  }, [searchParams, navigate])

  const handleRetryAuth = () => {
    navigate('/auth', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-primary p-4">
      <Card className="w-full max-w-md card-brand">
        <CardHeader className="text-center">
          <VirgilioLogo size="lg" className="justify-center mb-6" />
          {status === 'validating' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
                <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin"></div>
              </div>
              <CardTitle className="text-2xl font-poppins text-text-primary">Completing Sign In</CardTitle>
              <CardDescription className="text-text-secondary">
                Please wait while we validate your authentication...
              </CardDescription>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <CardTitle className="text-2xl font-poppins text-text-primary">Sign In Successful</CardTitle>
              <CardDescription className="text-text-secondary">
                Redirecting you to your workspace...
              </CardDescription>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-error/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-error" />
              </div>
              <CardTitle className="text-2xl font-poppins text-text-primary">Authentication Error</CardTitle>
              <CardDescription className="text-text-secondary">
                There was a problem completing your sign in
              </CardDescription>
            </>
          )}
        </CardHeader>
        
        {status === 'error' && (
          <CardContent className="space-y-4">
            <Alert className="bg-error/10 border-error/20">
              <AlertTriangle className="h-4 w-4 text-error" />
              <AlertDescription className="text-text-primary">
                {errorMessage}
              </AlertDescription>
            </Alert>
            
            <Button onClick={handleRetryAuth} className="w-full">
              Return to Sign In
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}