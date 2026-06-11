import { useEffect } from 'react'
import OnboardingFlow from '@/components/onboarding/flow/OnboardingFlow'

/**
 * Dev-only preview of the new onboarding flow.
 *
 * Mounted at /__preview/onboarding. Bypasses the real /onboarding pre-flight
 * controller (auth, invitations, domain auto-join) and stubs every backend
 * call so you can click through all 6 steps without creating real data.
 *
 * Step 6 "Go to your dashboard" resets the demo back to Step 1 instead of
 * navigating away.
 */
export default function OnboardingPreview() {
  useEffect(() => {
    sessionStorage.setItem('gio_ob_demo', '1')
    return () => {
      sessionStorage.removeItem('gio_ob_demo')
      sessionStorage.removeItem('gio_ob_demo_state')
    }
  }, [])

  return <OnboardingFlow demo />
}
