import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useOrgContext } from '@/contexts/OrgContext'
import { WorkspaceProvisioningLoader } from '@/components/onboarding/WorkspaceProvisioningLoader'
import { reconcilePendingInvitation, wasInvitationAccepted } from '@/lib/invitationReconciliation'
import OnboardingFlow from '@/components/onboarding/flow/OnboardingFlow'

/**
 * Onboarding page — thin pre-flight controller.
 *
 * Pre-flight (preserves existing critical paths):
 *   1. Already an active member → /dashboard
 *   2. Pending invitation reconcilable → auto-accept → /dashboard
 *   3. Verified-domain auto-join via provision-tenant → /dashboard
 *   4. Otherwise → render <OnboardingFlow /> (the new product-led flow).
 */
export default function Onboarding() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { refreshOrgContext } = useOrgContext()

  const [phase, setPhase] = useState<'checking' | 'auto-joining' | 'flow' | 'error'>('checking')

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const run = async () => {
      try {
        // 1. Existing active membership?
        const { data: existingMember } = await supabase
          .from('members')
          .select('tenant_id')
          .eq('user_id', user.id)
          .eq('user_status', 'active')
          .maybeSingle()

        if (existingMember) {
          if (cancelled) return
          toast({ title: 'Welcome back!', description: 'Taking you to your dashboard…' })
          navigate('/dashboard', { replace: true })
          return
        }

        // 2. Auto-accept pending invitations
        const reconcile = await reconcilePendingInvitation(user.id)
        if (wasInvitationAccepted(reconcile)) {
          if (cancelled) return
          toast({
            title: `Welcome to ${reconcile?.organization_name}!`,
            description: 'Taking you to your dashboard…',
          })
          await refreshOrgContext()
          navigate('/dashboard', { replace: true })
          return
        }

        // 3. Verified-domain auto-join
        const emailDomain = user.email?.split('@')[1]?.toLowerCase()
        const publicDomains = new Set([
          'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
          'icloud.com', 'aol.com', 'protonmail.com', 'mail.com',
        ])
        if (emailDomain && !publicDomains.has(emailDomain)) {
          if (cancelled) return
          setPhase('auto-joining')
          try {
            const { data, error } = await supabase.functions.invoke('provision-tenant', {
              body: { workspaceName: '' },
            })
            if (!error && data?.status === 'auto_joined') {
              await refreshOrgContext()
              toast({
                title: 'Welcome to your team!',
                description: data?.message || "You've been added to your team's workspace.",
              })
              navigate('/dashboard', { replace: true })
              return
            }
            if (!error && data?.status === 'ok' && data?.workspaceId) {
              await refreshOrgContext()
              navigate('/dashboard', { replace: true })
              return
            }
          } catch (err) {
            console.log('[Onboarding] auto-join check skipped', err)
          }
        }

        // 4. Show the new flow
        if (!cancelled) setPhase('flow')
      } catch (err) {
        console.error('[Onboarding] preflight failed', err)
        if (!cancelled) setPhase('flow')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [user, navigate, toast, refreshOrgContext])

  if (phase === 'auto-joining') {
    return <WorkspaceProvisioningLoader status="configuring" />
  }
  if (phase === 'checking') {
    // Quiet placeholder while preflight resolves — avoids flashing the flow.
    return <div style={{ minHeight: '100vh', background: '#fffcf9' }} />
  }
  return <OnboardingFlow />
}

// Optional: keep cancel handler if needed elsewhere
export async function signOutFromOnboarding(logout: () => Promise<void>, navigate: any) {
  try {
    await logout()
    navigate('/login', { replace: true })
  } catch (e) {
    console.error('Error signing out:', e)
  }
}
