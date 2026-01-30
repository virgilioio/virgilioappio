import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { GoGioLogo } from '@/components/GoGioLogo'
import { VerifyEmailPending } from '@/components/VerifyEmailPending'
import { useAuth } from '@/contexts/AuthContext'
import { useOrgContext } from '@/contexts/OrgContext'
import onboardingHero from '@/assets/onboarding-hero-new.png'
import { WorkspaceProvisioningLoader } from '@/components/onboarding/WorkspaceProvisioningLoader'
import { PendingInvitationAlert } from '@/components/onboarding/PendingInvitationAlert'
import { reconcilePendingInvitation, wasInvitationAccepted } from '@/lib/invitationReconciliation'

interface PendingInvitation {
  organization_name: string
  member_role: string
  invited_by_email?: string
  invite_expires_at: string
  member_id: string
}

export default function Onboarding() {
  const [workspaceName, setWorkspaceName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [provisioningStatus, setProvisioningStatus] = useState<'idle' | 'creating' | 'configuring' | 'finalizing' | 'complete'>('idle')
  const [pendingInvitation, setPendingInvitation] = useState<PendingInvitation | null>(null)
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
    setProvisioningStatus('creating')
    
    try {
      console.log('[Onboarding] Starting provision-tenant request', { workspaceName, userId: user?.id })
      
      // Step 1: Provision tenant
      const { data, error } = await supabase.functions.invoke('provision-tenant', {
        body: { workspaceName },
      })
      
      console.log('[Onboarding] Provision-tenant response', { data, error })
      
      if (error) {
        console.error('[Onboarding] Provision-tenant error', error)
        if (error.message?.includes('EMAIL_NOT_VERIFIED')) {
          setEmailVerified(false)
          setProvisioningStatus('idle')
          setIsSubmitting(false)
          return
        }
        throw error
      }
      
      const workspaceId = (data as any)?.workspaceId
      if (!workspaceId) throw new Error('Provisioning failed: no workspace id')

      // Step 2: Set organization context (non-blocking fallback)
      setProvisioningStatus('configuring')
      
      try {
        const setOrgPromise = supabase.functions.invoke('set-current-organization', {
          body: { organizationId: workspaceId },
        });
        
        // Wait max 8 seconds
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Set org timeout')), 8000)
        );
        
        const { error: setOrgErr } = await Promise.race([setOrgPromise, timeout]) as any;
        if (setOrgErr) {
          console.warn('[Onboarding] Set org failed, will retry in background:', setOrgErr);
          // Don't throw - continue with refresh which will set context via RPC
        }
      } catch (err) {
        console.warn('[Onboarding] Set org timeout, continuing:', err);
        // Non-fatal - the refreshOrgContext below will handle it
      }

      // Step 3: Refresh and wait for full propagation
      setProvisioningStatus('finalizing')
      
      await refreshOrgContext()

      // Step 4: Create booking configuration
      try {
        // Fetch profile to get first_name and last_name
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', user?.id)
          .single()

        if (profile?.first_name && profile?.last_name && workspaceId) {
          console.log('[Onboarding] Creating booking configuration...')
          const { data: bookingData, error: bookingErr } = await supabase.functions.invoke(
            'create-booking-config',
            {
              body: {
                first_name: profile.first_name,
                last_name: profile.last_name,
                organization_id: workspaceId,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
              }
            }
          )

          if (bookingErr) {
            console.warn('[Onboarding] Failed to create booking config:', bookingErr)
            // Non-fatal - continue onboarding
          } else {
            console.log('[Onboarding] Booking config created:', bookingData)
            sessionStorage.setItem('virgilio_booking_link_created', 'true')
          }
        }
      } catch (err) {
        console.warn('[Onboarding] Booking config creation error:', err)
        // Non-fatal - continue
      }
      
      // Set session flag to trigger first-run orientation in Find (after trial activation)
      sessionStorage.setItem('virgilio_first_run', 'true')
      
      // Navigate to Trial Activation page (CC wall)
      navigate('/trial-activation', { replace: true })
      
    } catch (err: any) {
      console.error('[Onboarding] Onboarding failed', err)
      setProvisioningStatus('idle')
      if (err?.message?.includes('EMAIL_NOT_VERIFIED')) {
        setEmailVerified(false)
      } else {
        toast({ 
          title: 'Onboarding failed', 
          description: err?.message || 'Unable to create workspace. Please try again or contact support.', 
          variant: 'destructive' 
        })
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

  // Pre-flight check: If user already has a workspace, redirect to dashboard
  // Also check for pending invitations and attempt auto-join for verified domains
  useEffect(() => {
    const checkExistingMembershipOrAutoJoin = async () => {
      if (!user || !emailVerified) return;
      
      // Check if user already has an active membership
      const { data: existingMember } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .maybeSingle();
      
      if (existingMember) {
        console.log('[Onboarding] User already has workspace, redirecting', { 
          tenantId: existingMember.tenant_id 
        });
        toast({
          title: 'Welcome back!',
          description: 'Taking you to your dashboard...',
        });
        navigate('/dashboard', { replace: true });
        return;
      }

      // 🎯 Enterprise invitation reconciliation: Auto-accept pending invitations
      // Instead of just showing an alert, we actively try to link the user
      const reconcileResult = await reconcilePendingInvitation(user.id);
      
      if (wasInvitationAccepted(reconcileResult)) {
        console.log('[Onboarding] Auto-accepted pending invitation', reconcileResult);
        toast({
          title: `Welcome to ${reconcileResult?.organization_name}!`,
          description: 'Taking you to your dashboard...',
        });
        await refreshOrgContext();
        navigate('/dashboard', { replace: true });
        return;
      }

      // Check for pending invitations that couldn't be auto-accepted (e.g., expired)
      // Show informational alert for these cases
      const { data: pendingInvite } = await supabase
        .from('members')
        .select(`
          id,
          member_role,
          invite_expires_at,
          organizations!inner (
            name
          )
        `)
        .eq('invited_email', user.email)
        .eq('user_status', 'invited')
        .maybeSingle();

      if (pendingInvite && pendingInvite.organizations) {
        console.log('[Onboarding] User has pending invitation (not auto-accepted)', pendingInvite);
        setPendingInvitation({
          organization_name: (pendingInvite.organizations as any).name || 'Unknown',
          member_role: pendingInvite.member_role,
          invite_expires_at: pendingInvite.invite_expires_at || '',
          member_id: pendingInvite.id,
          invited_by_email: undefined
        });
        // Don't return - still show the form but with a notice
      }
      
      // Check if user has a verified domain that could auto-join
      const emailDomain = user.email?.split('@')[1]?.toLowerCase();
      const isPublicDomain = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com', 'mail.com'].includes(emailDomain || '');
      
      if (!isPublicDomain && emailDomain) {
        console.log('[Onboarding] Checking for verified domain auto-join...', { emailDomain });
        
        setProvisioningStatus('creating');
        
        try {
          // Call provision-tenant - it will auto-join if domain is verified
          const { data, error } = await supabase.functions.invoke('provision-tenant', {
            body: { workspaceName: '' }, // Empty - just trigger domain check
          });
          
          if (error) {
            console.log('[Onboarding] No auto-join available', error.message);
            setProvisioningStatus('idle');
            return; // Show form as fallback
          }
          
          // Check if auto-joined
          if (data?.status === 'auto_joined') {
            console.log('[Onboarding] Auto-join successful', data);
            
            setProvisioningStatus('configuring');
            await refreshOrgContext();
            
            toast({
              title: 'Welcome to your team!',
              description: data?.message || 'You\'ve been automatically added to your team\'s workspace.',
            });
            
            setProvisioningStatus('finalizing');
            navigate('/dashboard', { replace: true });
            return;
          }
          
          // If we got here with "ok" status, user was already provisioned
          if (data?.status === 'ok' && data?.workspaceId) {
            console.log('[Onboarding] User already provisioned', data);
            await refreshOrgContext();
            navigate('/dashboard', { replace: true });
            return;
          }
          
          // Otherwise, show the form
          setProvisioningStatus('idle');
        } catch (err) {
          console.log('[Onboarding] Auto-join check failed, showing form', err);
          setProvisioningStatus('idle');
        }
      }
    };
    
    checkExistingMembershipOrAutoJoin();
  }, [user, emailVerified, navigate, toast, refreshOrgContext]);


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
    <>
      {/* Provisioning loader overlay */}
      {provisioningStatus !== 'idle' && (
        <WorkspaceProvisioningLoader 
          status={provisioningStatus === 'complete' ? 'finalizing' : provisioningStatus}
          className={provisioningStatus === 'complete' ? 'animate-fade-out' : ''}
        />
      )}
      
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
            <GoGioLogo size="xl" />
          </div>
           <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-2" style={{ fontFamily: 'Poppins', letterSpacing: '-0.06em' }}>
             Set up your workspace<span style={{ color: '#d7c5fb' }}>.</span>
           </h1>
           <p className="text-muted-foreground mt-2">Create your workspace and start your 14-day free trial.</p>
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
                <>
                  {pendingInvitation && (
                    <PendingInvitationAlert 
                      invitation={pendingInvitation} 
                      userEmail={userEmail}
                    />
                  )}
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
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  )
}
