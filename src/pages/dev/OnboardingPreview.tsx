import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { GoGioLogo } from '@/components/GoGioLogo'
import { WorkspaceProvisioningLoader } from '@/components/onboarding/WorkspaceProvisioningLoader'
import onboardingHero from '@/assets/onboarding-hero-new.png'

/**
 * DEV-ONLY visual preview of the onboarding screens.
 * - No auth, no Supabase, no provisioning. Purely presentational.
 * - Routed at /__preview/onboarding (guarded by import.meta.env.DEV in App.tsx).
 *
 * Query params:
 *   ?screen=workspace|account   → which screen to render (default: workspace)
 *   ?state=creating|configuring|finalizing|welcome → force loader overlay
 */
type LoaderState = 'creating' | 'configuring' | 'finalizing' | 'welcome'

export default function OnboardingPreview() {
  const [params, setParams] = useSearchParams()
  const screen = (params.get('screen') as 'workspace' | 'account') || 'workspace'
  const stateParam = params.get('state') as LoaderState | null

  const [workspaceName, setWorkspaceName] = useState('Acme Inc.')
  const [firstName, setFirstName] = useState('Jane')
  const [lastName, setLastName] = useState('Doe')
  const [loaderState, setLoaderState] = useState<LoaderState | null>(stateParam)

  useEffect(() => {
    setLoaderState(stateParam)
  }, [stateParam])

  // Simulate the provisioning sequence on submit (no network).
  const fakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const steps: LoaderState[] = ['creating', 'configuring', 'finalizing', 'welcome']
    for (const s of steps) {
      setLoaderState(s)
      await new Promise((r) => setTimeout(r, 1200))
    }
    setLoaderState(null)
  }

  const setScreen = (s: 'workspace' | 'account') => {
    const next = new URLSearchParams(params)
    next.set('screen', s)
    next.delete('state')
    setParams(next, { replace: true })
  }
  const setState = (s: LoaderState | null) => {
    const next = new URLSearchParams(params)
    if (s) next.set('state', s)
    else next.delete('state')
    setParams(next, { replace: true })
  }

  return (
    <>
      {/* Dev controls — fixed, top-right, above everything */}
      <div
        className="fixed top-3 right-3 z-[100] flex flex-col gap-2 rounded-lg border border-border bg-background/95 p-3 shadow-lg backdrop-blur"
        style={{ fontFamily: 'Inter', fontSize: 12 }}
      >
        <div className="flex items-center gap-2">
          <span className="rounded bg-virgilio-purple px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Dev Preview
          </span>
          <span className="text-muted-foreground">Onboarding</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setScreen('account')}
            className={`rounded px-2 py-1 ${screen === 'account' ? 'bg-foreground text-background' : 'bg-muted'}`}
          >
            Account
          </button>
          <button
            onClick={() => setScreen('workspace')}
            className={`rounded px-2 py-1 ${screen === 'workspace' ? 'bg-foreground text-background' : 'bg-muted'}`}
          >
            Workspace
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {(['creating', 'configuring', 'finalizing', 'welcome'] as LoaderState[]).map((s) => (
            <button
              key={s}
              onClick={() => setState(s)}
              className={`rounded px-2 py-1 ${loaderState === s ? 'bg-foreground text-background' : 'bg-muted'}`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => setState(null)}
            className={`rounded px-2 py-1 ${!loaderState ? 'bg-foreground text-background' : 'bg-muted'}`}
          >
            idle
          </button>
        </div>
      </div>

      {loaderState && <WorkspaceProvisioningLoader status={loaderState} />}

      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Left – hero */}
        <div
          className="w-full lg:w-1/2 relative overflow-hidden flex items-center justify-center min-h-[50vh] lg:min-h-screen"
          style={{ backgroundColor: '#fffead' }}
        >
          <img src={onboardingHero} alt="Onboarding Hero" className="h-full w-auto object-contain p-8" />
        </div>

        {/* Right – form */}
        <div className="w-full lg:w-1/2 bg-white flex flex-col justify-center px-6 sm:px-8 lg:px-8 xl:px-12 min-h-[50vh] lg:min-h-screen">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <GoGioLogo size="xl" />
            </div>
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-2"
              style={{ fontFamily: 'Poppins', letterSpacing: '-0.06em' }}
            >
              {screen === 'account' ? 'Set up your account' : 'Set up your workspace'}
              <span style={{ color: '#d7c5fb' }}>.</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              {screen === 'account'
                ? 'Tell us a bit about yourself before creating your workspace'
                : 'Create your workspace and start your 14-day free trial.'}
            </p>
          </div>

          <div className="w-full max-w-md mx-auto">
            <Card className="border-0 shadow-none bg-transparent p-0">
              <CardContent className="p-0">
                {screen === 'account' ? (
                  <form onSubmit={fakeSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-base font-medium">
                        First Name
                      </Label>
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
                      <Label htmlFor="lastName" className="text-base font-medium">
                        Last Name
                      </Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Smith"
                        required
                        className="h-12 text-base"
                      />
                    </div>
                    <Button type="submit" size="lg" className="w-full h-12">
                      Continue
                    </Button>
                    <div className="mt-6 text-center space-y-2">
                      <p className="text-xs text-muted-foreground">
                        You can complete this setup anytime after signing in
                      </p>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={fakeSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="workspaceName" className="text-base font-medium">
                        Workspace name
                      </Label>
                      <Input
                        id="workspaceName"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        placeholder="Acme Inc."
                        required
                        className="h-12 text-base"
                      />
                      <p className="text-sm text-muted-foreground">
                        Enter your company or organization name
                      </p>
                    </div>
                    <Button type="submit" size="lg" className="w-full h-12">
                      Create workspace
                    </Button>
                    <div className="mt-6 text-center space-y-2">
                      <p className="text-xs text-muted-foreground">
                        You can create your workspace anytime after signing in
                      </p>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
