import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { GoGioLogo } from '@/components/GoGioLogo'
import { log } from '@/lib/logger'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'validating' | 'success' | 'error'>('validating')
  const [errorMessage, setErrorMessage] = useState('')
  const processedRef = useRef(false)

  useEffect(() => {
    // Prevent double execution
    if (processedRef.current) return
    processedRef.current = true

    // Dev-only: Log URL state for debugging
    log.debug('[AuthCallback] URL:', window.location.href)
    log.debug('[AuthCallback] Has query code:', new URLSearchParams(window.location.search).has('code'))
    log.debug('[AuthCallback] Has hash access_token:', window.location.hash.includes('access_token'))

    let cancelled = false

    const waitForSession = async () => {
      const startTime = Date.now()
      const timeout = 5000 // 5 seconds

      while (!cancelled && Date.now() - startTime < timeout) {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (session) {
          log.debug('[AuthCallback] ✓ Session established:', {
            userId: session.user.id,
            email: session.user.email
          })
          
          setStatus('success')
          
          // Optional: Clean URL hash before navigation
          if (window.location.hash) {
            window.history.replaceState(null, '', '/auth/callback')
          }

          // Check if user has completed profile setup
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', session.user.id)
            .maybeSingle()

          if (!profile?.first_name || !profile?.last_name) {
            navigate('/account-setup', { replace: true })
            return
          }
          
          navigate('/dashboard', { replace: true })
          return
        }

        if (error) {
          log.error('[AuthCallback] Session error:', error)
          setErrorMessage(error.message || 'Failed to establish session')
          setStatus('error')
          return
        }

        // Poll every 150ms
        await new Promise(resolve => setTimeout(resolve, 150))
      }

      // Timeout reached
      if (!cancelled) {
        log.error('[AuthCallback] Session timeout')
        setErrorMessage('Could not complete sign-in. Please try again.')
        setStatus('error')
      }
    }

    waitForSession()

    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleRetryAuth = () => {
    navigate('/auth', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-primary p-4">
      <Card className="w-full max-w-md card-brand">
        <CardHeader className="text-center">
          <GoGioLogo size="lg" className="justify-center mb-6" />
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
            
            {import.meta.env.DEV && (
              <Alert className="bg-muted border-muted-foreground/20">
                <AlertDescription className="text-xs font-mono space-y-1">
                  <div><strong>Debug Info:</strong></div>
                  <div>URL: {window.location.href}</div>
                  <div>Has query code: {new URLSearchParams(window.location.search).has('code') ? 'YES' : 'NO'}</div>
                  <div>Has hash token: {window.location.hash.includes('access_token') ? 'YES' : 'NO'}</div>
                </AlertDescription>
              </Alert>
            )}
            
            <Button onClick={handleRetryAuth} className="w-full">
              Return to Sign In
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}