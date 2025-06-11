
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { VirgilioLogo } from '@/components/VirgilioLogo'

interface InvitationData {
  member_id: string
  organization_id: string
  member_role: string
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

  useEffect(() => {
    if (!token) {
      navigate('/login')
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

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm() || !invitationData?.is_valid || !invitationData.invite_email) return

    setIsSubmitting(true)

    try {
      console.log('Creating user account for:', invitationData.invite_email)
      
      // Create the user account using the email from the invitation
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitationData.invite_email,
        password: password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim()
          },
          emailRedirectTo: 'https://app.virgilio.io/'
        }
      })

      if (signUpError) {
        console.error('Error creating user:', signUpError)
        throw signUpError
      }

      if (!authData.user) {
        throw new Error('Failed to create user account')
      }

      console.log('User created successfully:', authData.user.id)

      // Wait a moment to ensure the user is properly created in the database
      await sleep(1000)

      // Accept the invitation by linking the user_id with retry logic
      let retryCount = 0
      const maxRetries = 3
      let acceptResult = null

      while (retryCount < maxRetries) {
        try {
          console.log(`Attempting to accept invitation (attempt ${retryCount + 1})`)
          
          const { data: acceptData, error: acceptError } = await supabase.rpc('accept_invitation', {
            token_input: token,
            new_user_id: authData.user.id
          })

          if (acceptError) {
            console.error(`Error accepting invitation (attempt ${retryCount + 1}):`, acceptError)
            
            // If it's a foreign key constraint error, wait a bit longer and retry
            if (acceptError.message.includes('foreign key constraint') || acceptError.message.includes('violates')) {
              retryCount++
              if (retryCount < maxRetries) {
                console.log('Foreign key constraint error, retrying in 2 seconds...')
                await sleep(2000)
                continue
              }
            }
            throw acceptError
          }

          acceptResult = acceptData?.[0]
          break // Success, exit retry loop
          
        } catch (error) {
          retryCount++
          if (retryCount >= maxRetries) {
            throw error
          }
          console.log(`Retry ${retryCount} failed, waiting before next attempt...`)
          await sleep(2000)
        }
      }

      if (!acceptResult?.success) {
        throw new Error(acceptResult?.error_message || 'Failed to accept invitation')
      }

      console.log('Invitation accepted successfully')

      toast({
        title: 'Welcome to Virgilio!',
        description: `You've successfully joined ${invitationData.organization_name}.`
      })

      // Redirect to email verification page with context
      navigate(`/verify-email?email=${encodeURIComponent(invitationData.invite_email)}&organization=${encodeURIComponent(invitationData.organization_name)}`)

    } catch (error: any) {
      console.error('Error accepting invitation:', error)
      
      let errorMessage = 'Failed to accept invitation. Please try again.'
      
      // Provide more specific error messages
      if (error.message?.includes('User already registered')) {
        errorMessage = 'This email is already registered. Please try logging in instead.'
      } else if (error.message?.includes('foreign key constraint')) {
        errorMessage = 'There was a temporary issue. Please try again in a few moments.'
      } else if (error.message?.includes('expired')) {
        errorMessage = 'This invitation has expired. Please request a new invitation.'
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <VirgilioLogo size="lg" className="justify-center mb-4" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Validating invitation...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invitationData?.is_valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <VirgilioLogo size="lg" className="justify-center mb-4" />
            <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-red-900">Invalid Invitation</CardTitle>
            <CardDescription>
              {invitationData?.error_message || 'This invitation link is invalid or has expired.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/login')} 
              className="w-full"
              variant="outline"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <VirgilioLogo size="lg" className="justify-center mb-4" />
          <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-2xl">You're Invited!</CardTitle>
          <CardDescription>
            Join <strong>{invitationData.organization_name}</strong> as a{' '}
            <strong>{invitationData.member_role.replace('_', ' ')}</strong>
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Alert className="mb-6">
            <AlertDescription>
              Creating account for: <strong>{invitationData.invite_email}</strong>
            </AlertDescription>
          </Alert>

          <form onSubmit={handleAcceptInvitation} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  disabled={isSubmitting}
                />
                {errors.firstName && (
                  <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  disabled={isSubmitting}
                />
                {errors.lastName && (
                  <p className="text-sm text-red-600 mt-1">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
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
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600 mt-1">{errors.password}</p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
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
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-600 mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Accept Invitation & Create Account'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
