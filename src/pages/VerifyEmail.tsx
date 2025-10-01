
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, RefreshCw, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { VirgilioLogo } from '@/components/VirgilioLogo'

export default function VerifyEmail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  
  const email = searchParams.get('email')
  const organizationName = searchParams.get('organization')

  useEffect(() => {
    if (!email) {
      navigate('/auth')
    }
  }, [email, navigate])

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleResendEmail = async () => {
    if (!email || resendCooldown > 0) return

    setIsResending(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      })

      if (error) throw error

      toast({
        title: 'Verification email sent',
        description: 'Please check your inbox for the verification link.'
      })
      
      setResendCooldown(60) // 60 second cooldown
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend verification email',
        variant: 'destructive'
      })
    } finally {
      setIsResending(false)
    }
  }

  if (!email) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-primary p-4">
      <Card className="w-full max-w-md card-brand">
        <CardHeader className="text-center">
          <VirgilioLogo size="lg" className="justify-center mb-6" />
          <div className="mx-auto mb-4 w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
            <Mail className="h-8 w-8 text-accent" />
          </div>
          <CardTitle className="text-2xl font-poppins text-text-primary">Check Your Email</CardTitle>
          <CardDescription className="text-text-secondary">
            We've sent a verification link to verify your account
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert className="bg-success/10 border-success/20">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-text-primary">
              <strong>Account created successfully!</strong>
              {organizationName && (
                <span> You've been added to <strong>{organizationName}</strong>.</span>
              )}
            </AlertDescription>
          </Alert>

          <div className="text-center space-y-4">
            <p className="text-sm text-text-secondary">
              We sent a verification email to:
            </p>
            <p className="font-medium break-all text-text-primary font-poppins">{email}</p>
            <p className="text-sm text-text-secondary">
              Click the verification link in your email to complete your account setup and start using Virgilio.
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={handleResendEmail}
              disabled={isResending || resendCooldown > 0}
              variant="outline"
              className="w-full"
              loading={isResending}
            >
              {resendCooldown > 0 ? (
                `Resend in ${resendCooldown}s`
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Resend verification email
                </>
              )}
            </Button>

            <Button
              onClick={() => navigate('/auth')}
              variant="ghost"
              className="w-full"
            >
              Back to Login
            </Button>
          </div>

          <Alert className="bg-warning/10 border-warning/20">
            <AlertDescription className="text-xs text-center text-text-secondary">
              <strong>Can't find the email?</strong> Check your spam folder or contact support if you continue having issues.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
