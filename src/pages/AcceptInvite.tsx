
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { GoGioLogo } from '@/components/GoGioLogo'

interface InvitationData {
  member_id: string
  organization_id: string
  member_role: string // legacy from RPC
  system_role?: string
  organization_name: string
  invite_email: string
  is_valid: boolean
  error_message: string
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  
  const [isValidating, setIsValidating] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  // P2: State for requesting new invitation
  const [isRequestingNewInvite, setIsRequestingNewInvite] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  useEffect(() => {
    if (!token) {
      navigate('/auth')
      return
    }
    validateInvitation()
  }, [token])

  const validateInvitation = async () => {
    try {
      console.log('Validating invitation token:', token)
      
      const { data, error } = await supabase.rpc('validate_invite_token', {
        token_input: token
      })

      if (error) {
        console.error('Error validating invitation:', error)
        throw error
      }

      if (data && data.length > 0) {
        const invitation = data[0]
        console.log('Invitation validation result:', invitation)
        setInvitationData(invitation)
      } else {
        setInvitationData({
          member_id: '',
          organization_id: '',
          member_role: '',
          organization_name: '',
          invite_email: '',
          is_valid: false,
          error_message: 'Invalid invitation token'
        })
      }
    } catch (error) {
      console.error('Error validating invitation:', error)
      setInvitationData({
        member_id: '',
        organization_id: '',
        member_role: '',
        organization_name: '',
        invite_email: '',
        is_valid: false,
        error_message: 'Failed to validate invitation'
      })
    } finally {
      setIsValidating(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm() || !invitationData?.is_valid || !invitationData.invite_email) return

    setIsSubmitting(true)

    try {
      console.log('Attempting to create new user account for:', invitationData.invite_email)
      
      // Create the user account with auto-confirmation
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitationData.invite_email,
        password: password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim()
          },
          emailRedirectTo: window.location.origin
        }
      })

      if (signUpError) {
        console.error('Error creating user:', signUpError)
        
        // Handle specific signup errors
        if (signUpError.message.includes('User already registered')) {
          console.log('User already exists, trying to sign them in...')
          
          // Try to sign in the existing user
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: invitationData.invite_email,
            password: password
          });

          if (signInError) {
            if (signInError.message.includes('Invalid login credentials')) {
              setErrors({ 
                general: 'An account with this email already exists, but the password is incorrect. Please contact your administrator for assistance.'
              });
            } else {
              setErrors({ general: `Sign-in failed: ${signInError.message}` });
            }
            return;
          }

          if (!signInData.user) {
            throw new Error('Sign in failed - no user returned');
          }

          console.log('Existing user signed in successfully:', signInData.user.id);

          // Accept the invitation for the existing user
          const { data: edgeFunctionResult, error: edgeFunctionError } = await supabase.functions.invoke(
            'accept-invitation-with-metadata',
            {
              body: {
                token: token,
                newUserId: signInData.user.id
              }
            }
          );

          if (edgeFunctionError) {
            console.error('Edge function error:', edgeFunctionError);
            throw new Error(edgeFunctionError.message || 'Failed to process invitation');
          }

          if (!edgeFunctionResult?.success) {
            throw new Error(edgeFunctionResult?.error || 'Failed to accept invitation');
          }

          console.log('Invitation accepted for existing user:', edgeFunctionResult);
          
          toast({
            title: 'Welcome back to Virgilio!',
            description: `You've successfully joined ${invitationData.organization_name} as ${edgeFunctionResult.result.system_role === 'admin' ? 'Admin' : 'Member'}.`,
            variant: 'default'
          });

          navigate('/dashboard');
          return;
        } else if (signUpError.message.includes('Database error saving new user')) {
          setErrors({ general: 'There was an issue creating your account. Please try again or contact support.' });
        } else {
          throw signUpError;
        }
        return;
      }

      if (!authData.user) {
        throw new Error('Failed to create user account')
      }

      console.log('User created successfully:', authData.user.id)

      // Use the edge function to accept invitation and inject metadata
      const { data: edgeFunctionResult, error: edgeFunctionError } = await supabase.functions.invoke(
        'accept-invitation-with-metadata',
        {
          body: {
            token: token,
            newUserId: authData.user.id
          }
        }
      )

      if (edgeFunctionError) {
        console.error('Edge function error:', edgeFunctionError)
        throw new Error(edgeFunctionError.message || 'Failed to process invitation')
      }

      if (!edgeFunctionResult?.success) {
        throw new Error(edgeFunctionResult?.error || 'Failed to accept invitation')
      }

      console.log('Invitation processed successfully:', edgeFunctionResult)

      // If user was created but not confirmed (needs email verification)
      if (authData.user && !authData.user.email_confirmed_at) {
        console.log('User needs email confirmation, but auto-signing in...')
        
        // Attempt to sign in the user immediately
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: invitationData.invite_email,
          password: password
        })

        if (signInError) {
          console.log('Auto sign-in failed, user will need to verify email:', signInError)
          // Show success message but redirect to verification
          toast({
            title: 'Account Created Successfully!',
            description: `Please check your email (${invitationData.invite_email}) to verify your account before signing in.`,
            variant: 'default'
          })
          navigate(`/verify-email?email=${encodeURIComponent(invitationData.invite_email)}&organization=${encodeURIComponent(invitationData.organization_name)}`)
          return
        }

        console.log('User auto-signed in successfully:', signInData.user?.id)
      }

      // Show success message and redirect to dashboard
      const hasWarning = edgeFunctionResult.warning
      toast({
        title: hasWarning ? 'Welcome to Virgilio!' : 'Welcome to Virgilio!',
        description: hasWarning 
          ? `You've joined ${invitationData.organization_name}! Some metadata may not be immediately available.`
          : `You've successfully joined ${invitationData.organization_name} as ${edgeFunctionResult.result.system_role === 'admin' ? 'Admin' : 'Member'}.`,
        variant: 'default'
      })

      // Redirect to dashboard
      navigate('/dashboard')

    } catch (error: any) {
      console.error('Error accepting invitation:', error)
      
      let errorMessage = 'Failed to accept invitation. Please try again.'
      
      // Provide more specific error messages
      if (error.message?.includes('User already registered')) {
        errorMessage = 'This email is already registered. Please try logging in instead.'
      } else if (error.message?.includes('expired')) {
        errorMessage = 'This invitation has expired. Please request a new invitation.'
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = 'Please check your email to confirm your account before signing in.'
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-primary p-4">
        <Card className="w-full max-w-md card-brand">
          <CardHeader className="text-center">
            <GoGioLogo size="lg" className="justify-center mb-6" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-center space-x-3">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <span className="text-text-primary">Validating invitation...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invitationData?.is_valid) {
    const isExpired = invitationData?.error_message?.toLowerCase().includes('expired')
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-primary p-4">
        <Card className="w-full max-w-md card-brand">
          <CardHeader className="text-center">
            <GoGioLogo size="lg" className="justify-center mb-6" />
            <div className="mx-auto mb-4 w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-text-primary font-poppins">
              {isExpired ? 'Invitation Expired' : 'Invalid Invitation'}
            </CardTitle>
            <CardDescription className="text-text-secondary">
              {isExpired 
                ? 'This invitation link has expired. Please contact your workspace administrator for a new invitation.'
                : (invitationData?.error_message || 'This invitation link is invalid or has already been used.')
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isExpired && !requestSent && (
              <Alert className="bg-muted/50 border-border">
                <AlertDescription className="text-sm text-text-secondary">
                  <strong>What to do:</strong>
                  <ol className="list-decimal ml-4 mt-2 space-y-1">
                    <li>Click the button below to request a new invitation</li>
                    <li>Your admin will be notified and can resend your invite</li>
                    <li>Check your email for the new invitation link</li>
                  </ol>
                </AlertDescription>
              </Alert>
            )}
            {requestSent && (
              <Alert className="bg-success/10 border-success/20">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertDescription className="text-sm text-text-primary ml-2">
                  <strong>Request sent!</strong> Your administrator has been notified. 
                  They will send you a new invitation shortly. Please check your email.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              {isExpired && !requestSent && invitationData?.invite_email && (
                <Button 
                  onClick={async () => {
                    setIsRequestingNewInvite(true)
                    try {
                      const { error } = await supabase.functions.invoke('request-new-invitation', {
                        body: { email: invitationData.invite_email }
                      })
                      if (error) throw error
                      setRequestSent(true)
                      toast({
                        title: 'Request Sent',
                        description: 'Your administrator has been notified. They will send you a new invitation shortly.',
                      })
                    } catch (error) {
                      console.error('Failed to request new invitation:', error)
                      toast({
                        title: 'Error',
                        description: 'Failed to request new invitation. Please contact your administrator directly.',
                        variant: 'destructive'
                      })
                    } finally {
                      setIsRequestingNewInvite(false)
                    }
                  }}
                  disabled={isRequestingNewInvite}
                  className="w-full"
                >
                  {isRequestingNewInvite ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Requesting...
                    </>
                  ) : (
                    'Request New Invitation'
                  )}
                </Button>
              )}
              <Button 
                onClick={() => navigate('/auth')} 
                className="w-full"
                variant={isExpired ? 'outline' : 'default'}
              >
                {isExpired ? 'Already have an account? Sign In' : 'Go to Login'}
              </Button>
              {isExpired && !requestSent && (
                <p className="text-xs text-center text-text-secondary">
                  Or contact your administrator directly
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-primary p-4">
      <Card className="w-full max-w-md card-brand">
        <CardHeader className="text-center">
          <GoGioLogo size="lg" className="justify-center mb-6" />
          <div className="mx-auto mb-4 w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <CardTitle className="text-2xl font-poppins text-text-primary">You're Invited!</CardTitle>
          <CardDescription className="text-text-secondary">
            Join <strong className="text-text-primary">{invitationData.organization_name}</strong> as a{' '}
            <strong className="text-text-primary">{invitationData.system_role === 'admin' ? 'Admin' : invitationData.system_role === 'member' ? 'Member' : invitationData.member_role.replace('_', ' ')}</strong>
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Alert className="mb-6 bg-accent/10 border-accent/20">
            <AlertDescription className="text-text-primary">
              Creating account for: <strong>{invitationData.invite_email}</strong>
            </AlertDescription>
          </Alert>

          <form onSubmit={handleAcceptInvitation} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="text-text-primary">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  disabled={isSubmitting}
                  className="mt-2"
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive mt-1">{errors.firstName}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="lastName" className="text-text-primary">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  disabled={isSubmitting}
                  className="mt-2"
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive mt-1">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-text-primary">Password</Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  disabled={isSubmitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive mt-1">{errors.password}</p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-text-primary">Confirm Password</Label>
              <div className="relative mt-2">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  disabled={isSubmitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {errors.general && (
              <Alert className="bg-destructive/10 border-destructive/20">
                <AlertDescription className="text-destructive">
                  {errors.general}
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full mt-8" 
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              {isSubmitting ? 'Creating Account...' : 'Accept Invitation & Create Account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
