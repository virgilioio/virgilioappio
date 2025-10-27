import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { VirgilioLogo } from '@/components/VirgilioLogo'
import { VerifyEmailPending } from '@/components/VerifyEmailPending'
import { useAuth } from '@/contexts/AuthContext'
import onboardingHero from '@/assets/onboarding-hero-new.png'

export default function AccountSetup() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const navigate = useNavigate()
  
  const { user, logout } = useAuth()

  useEffect(() => {
    const checkEmailAndProfile = async () => {
      if (!user) return

      setUserEmail(user.email || '')
      
      // Check if email is verified
      const isGoogleOAuth = user.app_metadata?.provider === 'google'
      const isVerified = isGoogleOAuth 
        ? user.user_metadata?.email_verified === true
        : user.email_confirmed_at !== null

      setEmailVerified(isVerified)

      // Pre-fill from metadata if available (e.g., Google OAuth)
      if (user.user_metadata?.first_name) {
        setFirstName(user.user_metadata.first_name)
      }
      if (user.user_metadata?.last_name) {
        setLastName(user.user_metadata.last_name)
      }

      // Check if profile already exists with name - if so, skip to onboarding
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profile?.first_name && profile?.last_name) {
        console.log('[AccountSetup] Profile already complete, redirecting to onboarding')
        navigate('/onboarding', { replace: true })
      }
    }

    checkEmailAndProfile()
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Update user's profile in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName
        })
        .eq('user_id', user?.id)

      if (profileError) throw profileError

      // Also update auth metadata for consistency
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName
        }
      })

      if (metadataError) {
        console.warn('[AccountSetup] Failed to update auth metadata:', metadataError)
        // Non-fatal - continue
      }

      toast.success('Account setup complete! Now let\'s set up your workspace.')

      // Navigate to workspace creation
      navigate('/onboarding', { replace: true })
      
    } catch (err: any) {
      toast.error(err?.message || 'Setup failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEmailVerified = () => {
    setEmailVerified(true)
    toast.success('Email verified! You can now complete your account setup.')
  }

  const handleCancel = async () => {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Error signing out:', error)
      toast.error('Sign out failed. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Hero Image */}
      <div className="w-full lg:w-1/2 relative overflow-hidden flex items-center justify-center min-h-[50vh] lg:min-h-screen" style={{ backgroundColor: '#fffead' }}>
        <img 
          src={onboardingHero} 
          alt="Account Setup Hero" 
          className="h-full w-auto object-contain p-8"
        />
      </div>

      {/* Right Side - Account Setup Form */}
      <div className="w-full lg:w-1/2 bg-background flex flex-col justify-center px-6 sm:px-8 lg:px-8 xl:px-12 min-h-[50vh] lg:min-h-screen">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <VirgilioLogo size="xl" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-2" style={{ fontFamily: 'Poppins', letterSpacing: '-0.06em' }}>
            Set up your account<span style={{ color: '#d7c5fb' }}>.</span>
          </h1>
          <p className="text-muted-foreground mt-2">Tell us a bit about yourself before creating your workspace</p>
        </div>

        <div className="w-full max-w-md mx-auto">
          <Card className="border-0 shadow-none bg-transparent p-0">
            <CardContent className="p-0">
              {emailVerified === false ? (
                <VerifyEmailPending 
                  userEmail={userEmail} 
                  onVerified={handleEmailVerified}
                />
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-base font-medium">First Name</Label>
                    <Input 
                      id="firstName" 
                      value={firstName} 
                      onChange={(e) => setFirstName(e.target.value)} 
                      placeholder="John" 
                      required 
                      className="h-12 text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-base font-medium">Last Name</Label>
                    <Input 
                      id="lastName" 
                      value={lastName} 
                      onChange={(e) => setLastName(e.target.value)} 
                      placeholder="Smith" 
                      required 
                      className="h-12 text-base"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full h-12" 
                    disabled={isSubmitting || !emailVerified}
                  >
                    {isSubmitting ? 'Saving...' : 'Continue'}
                  </Button>

                  <div className="mt-6 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      You can complete this setup anytime after signing in
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCancel}
                      disabled={isSubmitting}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Not ready yet? Sign out
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
