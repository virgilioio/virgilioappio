import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { VirgilioLogo } from '@/components/VirgilioLogo'
import { VerifyEmailPending } from '@/components/VerifyEmailPending'
import { useAuth } from '@/contexts/AuthContext'
import { useOrgContext } from '@/contexts/OrgContext'
import onboardingHero from '@/assets/onboarding-hero-new.png'

export default function Onboarding() {
  const [workspaceName, setWorkspaceName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const { toast } = useToast()
  const navigate = useNavigate()
  
  const { user, logout } = useAuth()
  const { refreshOrgContext } = useOrgContext()

  useEffect(() => {
    const checkEmailVerification = async () => {
      if (!user) return

      setUserEmail(user.email || '')
      
      // Check if email is verified
      const isGoogleOAuth = user.app_metadata?.provider === 'google'
      const isVerified = isGoogleOAuth 
        ? user.user_metadata?.email_verified === true
        : user.email_confirmed_at !== null

      setEmailVerified(isVerified)
    }

    checkEmailVerification()
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceName.trim()) {
      toast({ title: 'Workspace name is required', variant: 'destructive' })
      return
    }
    setIsSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('provision-tenant', {
        body: { workspaceName },
      })
      if (error) {
        // Handle email verification error specifically
        if (error.message?.includes('EMAIL_NOT_VERIFIED')) {
          setEmailVerified(false)
          setIsSubmitting(false)
          return
        }
        throw error
      }
      const tenantId = (data as any)?.tenantId
      const workspaceId = (data as any)?.workspaceId
      if (!workspaceId) throw new Error('Provisioning failed: no workspace id')

      // Set current organization context to the workspace
      const { error: setOrgErr } = await supabase.functions.invoke('set-current-organization', {
        body: { organizationId: workspaceId },
      })
      if (setOrgErr) throw setOrgErr

      toast({ title: 'Workspace created', description: 'Your trial is active for 30 days.' })
      
      // Refresh org context from database (DB-driven, not JWT-driven)
      await refreshOrgContext()
      
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      if (err?.message?.includes('EMAIL_NOT_VERIFIED')) {
        setEmailVerified(false)
      } else {
        toast({ title: 'Onboarding failed', description: err?.message || 'Please try again', variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEmailVerified = () => {
    setEmailVerified(true)
    toast({ 
      title: 'Email verified!', 
      description: 'You can now create your workspace.' 
    })
  }

  const handleCancel = async () => {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Error signing out:', error)
      toast({ 
        title: 'Sign out failed', 
        description: 'Please try again',
        variant: 'destructive' 
      })
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* Left Side - Responsive width with #fffead background */}
      <div className="w-full lg:w-1/2 relative overflow-hidden flex items-center justify-center min-h-[50vh] lg:min-h-screen" style={{ backgroundColor: '#fffead' }}>
        <img 
          src={onboardingHero} 
          alt="Onboarding Hero" 
          className="h-full w-auto object-contain p-8"
        />
      </div>

      {/* Right Side - Responsive width white background with onboarding form */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col justify-center px-6 sm:px-8 lg:px-8 xl:px-12 min-h-[50vh] lg:min-h-screen">
        {/* Welcome Text - Full width and centered */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <VirgilioLogo size="xl" />
          </div>
           <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-2" style={{ fontFamily: 'Poppins', letterSpacing: '-0.06em' }}>
             Set up your workspace<span style={{ color: '#d7c5fb' }}>.</span>
           </h1>
           <p className="text-muted-foreground mt-2">Create your tenant and first workspace. 30‑day free trial, no card needed.</p>
        </div>

        {/* Content Container with max width */}
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
                    <Label htmlFor="workspaceName" className="text-base font-medium">Workspace name</Label>
                    <Input 
                      id="workspaceName" 
                      value={workspaceName} 
                      onChange={(e) => setWorkspaceName(e.target.value)} 
                      placeholder="Acme Inc." 
                      required 
                      className="h-12 text-base"
                    />
                    <p className="text-sm text-muted-foreground">Enter your company or organization name</p>
                  </div>
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full h-12" 
                    disabled={isSubmitting || !emailVerified}
                  >
                    {isSubmitting ? 'Creating...' : 'Create workspace'}
                  </Button>
                  <div className="mt-6 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      You can create your workspace anytime after signing in
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
