import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, RefreshCw, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface VerifyEmailPendingProps {
  userEmail: string
  onVerified: () => void
}

export function VerifyEmailPending({ userEmail, onVerified }: VerifyEmailPendingProps) {
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [isChecking, setIsChecking] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return

    setIsResending(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
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

  const handleCheckVerification = async () => {
    setIsChecking(true)
    try {
      // Refresh the session to get updated user data
      const { error } = await supabase.auth.refreshSession()
      if (error) throw error

      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email_confirmed_at) {
        onVerified()
      } else {
        toast({
          title: 'Email not verified yet',
          description: 'Please click the verification link in your email first.',
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      toast({
        title: 'Error checking verification',
        description: error.message || 'Please try again',
        variant: 'destructive'
      })
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="space-y-6">
      <Alert className="bg-warning/10 border-warning/20">
        <Mail className="h-4 w-4 text-warning" />
        <AlertDescription className="text-text-primary">
          <strong>Email verification required</strong>
          <br />
          We sent a verification link to <strong>{userEmail}</strong>. Please check your inbox and click the link to verify your email before creating your workspace.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <Button
          onClick={handleResendEmail}
          disabled={isResending || resendCooldown > 0}
          variant="outline"
          className="w-full"
        >
          {isResending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : resendCooldown > 0 ? (
            `Resend in ${resendCooldown}s`
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Resend verification email
            </>
          )}
        </Button>

        <Button
          onClick={handleCheckVerification}
          disabled={isChecking}
          className="w-full"
        >
          {isChecking ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              I've verified my email
            </>
          )}
        </Button>
      </div>

      <Alert className="bg-info/10 border-info/20">
        <AlertDescription className="text-xs text-center text-text-secondary">
          <strong>Can't find the email?</strong> Check your spam folder or try resending the verification email.
        </AlertDescription>
      </Alert>
    </div>
  )
}