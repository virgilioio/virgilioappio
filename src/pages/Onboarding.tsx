import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { useWorkerComplianceCountries } from '@/hooks/useWorkerComplianceCountries'
import { VerifyEmailPending } from '@/components/VerifyEmailPending'
import { useAuth } from '@/contexts/AuthContext'

export default function Onboarding() {
  const [companyName, setCompanyName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const { toast } = useToast()
  const navigate = useNavigate()
  const { countries, isLoading: countriesLoading } = useWorkerComplianceCountries()
  const { user } = useAuth()

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
    if (!companyName.trim()) {
      toast({ title: 'Company name is required', variant: 'destructive' })
      return
    }
    if (!countryCode) {
      toast({ title: 'Country is required', variant: 'destructive' })
      return
    }
    setIsSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('provision-tenant', {
        body: { companyName, workspaceName: workspaceName || companyName, countryCode },
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
      // Refresh session to ensure updated organization metadata is available to AuthContext
      try {
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          console.warn('Session refresh error:', refreshError)
        }
        const { data: { session: newSession } } = await supabase.auth.getSession()
        const orgInSession = (newSession?.user?.user_metadata as any)?.organization_id
        if (!orgInSession) {
          // Allow a short delay for metadata propagation as a safe guard
          await new Promise((r) => setTimeout(r, 200))
        }
      } catch (e) {
        console.warn('Post-onboarding session sync warning:', e)
      }
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Set up your workspace</h1>
          <p className="text-muted-foreground mt-2">Create your tenant and first workspace. 30‑day free trial, no card needed.</p>
        </div>

        <Card>
          <CardContent className="p-6">
            {emailVerified === false ? (
              <VerifyEmailPending 
                userEmail={userEmail} 
                onVerified={handleEmailVerified}
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company name</Label>
                <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspaceName">Workspace name (optional)</Label>
                <Input id="workspaceName" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Acme Workspace" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select value={countryCode} onValueChange={setCountryCode} required disabled={countriesLoading}>
                  <SelectTrigger id="country">
                    <SelectValue placeholder={countriesLoading ? "Loading countries..." : countries.length === 0 ? "No countries available" : "Select your country"} />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                    {countries.length === 0 && !countriesLoading && (
                      <SelectItem value="" disabled>
                        No countries configured yet
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full" 
                  disabled={isSubmitting || countriesLoading || countries.length === 0 || !emailVerified}
                >
                  {isSubmitting ? 'Creating...' : 'Create workspace'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
