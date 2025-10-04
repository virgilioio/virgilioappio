import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { VirgilioLogo } from '@/components/VirgilioLogo'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'validating' | 'success' | 'error'>('validating')
  const [errorMessage, setErrorMessage] = useState('')
  const exchangedRef = useRef(false)

  useEffect(() => {
    // Prevent double execution
    if (exchangedRef.current) return
    exchangedRef.current = true

    const processAuthCallback = async () => {
      try {
        console.debug('[AuthCallback] Exchanging code for session...')
        
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        )
        
        if (exchangeError) {
          console.error('[AuthCallback] Exchange error:', exchangeError)
          setErrorMessage(exchangeError.message || 'Failed to complete sign-in')
          setStatus('error')
          return
        }

        console.debug('[AuthCallback] ✓ Session established')
        setStatus('success')
        
        console.debug('[AuthCallback] → Navigating to /dashboard')
        navigate('/dashboard', { replace: true })

      } catch (err) {
        console.error('[AuthCallback] Unexpected error:', err)
        setErrorMessage('An unexpected error occurred during sign-in')
        setStatus('error')
      }
    }

    processAuthCallback()
  }, [navigate])

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