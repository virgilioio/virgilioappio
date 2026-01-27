import { useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { GoGioLogo } from '@/components/GoGioLogo'
import { useAuth } from '@/contexts/AuthContext'
import { useBillingStatus } from '@/hooks/useBillingStatus'
import { useCreateCheckout } from '@/hooks/useBillingPortal'
import { Check, CreditCard, Sparkles, Users, Calendar, Mail, AlertCircle } from 'lucide-react'
import authGraphic from '@/assets/auth-graphic.png'
import { Alert, AlertDescription } from '@/components/ui/alert'

const TRIAL_BENEFITS = [
  { icon: Users, text: 'Unlimited jobs & candidates' },
  { icon: Sparkles, text: 'AI-powered candidate screening' },
  { icon: CreditCard, text: '20 enrichment credits to try sourcing' },
  { icon: Mail, text: 'Email & calendar sync' },
  { icon: Calendar, text: 'Built-in scheduling & booking' },
]

export default function TrialActivation() {
  const { logout } = useAuth()
  const { data: billing, isLoading } = useBillingStatus()
  const createCheckout = useCreateCheckout()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const wasCanceled = searchParams.get('canceled') === 'true'

  // If already trialing or active, redirect to dashboard
  useEffect(() => {
    if (billing && ['trialing', 'active', 'grace_period'].includes(billing.billing_status)) {
      navigate('/dashboard', { replace: true })
    }
  }, [billing, navigate])

  const handleStartTrial = () => {
    createCheckout.mutate({ interval: 'month', startTrial: true })
  }

  const handleSignOut = async () => {
    try {
      await logout()
      navigate('/auth', { replace: true })
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#d7c5fb' }}>
        <div className="text-center space-y-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-foreground/70">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Graphic */}
      <div 
        className="w-full lg:w-1/2 relative overflow-hidden flex items-center justify-center min-h-[40vh] lg:min-h-screen" 
        style={{ backgroundColor: '#d7c5fb' }}
      >
        <img 
          src={authGraphic} 
          alt="Start your journey" 
          className="max-h-[90%] max-w-[90%] object-contain"
          style={{ filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.08))' }}
        />
      </div>

      {/* Right Side - Trial activation content */}
      <div 
        className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-8 lg:px-8 xl:px-12 min-h-[60vh] lg:min-h-screen py-8 lg:py-0" 
        style={{ backgroundColor: '#d7c5fb' }}
      >
        {/* Logo and heading */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <GoGioLogo size="xl" />
          </div>
          <h1 
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-2" 
            style={{ fontFamily: 'Poppins', letterSpacing: '-0.06em' }}
          >
            Start your free trial<span style={{ color: '#7c3aed' }}>.</span>
          </h1>
          <p className="text-foreground/70 mt-2 text-base">
            14 days free. Cancel anytime.
          </p>
        </div>

        {/* Card wrapper */}
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            {/* Canceled checkout alert */}
            {wasCanceled && (
              <Alert className="mb-6 border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Checkout was canceled. Ready to try again?
                </AlertDescription>
              </Alert>
            )}

            {/* Trial info */}
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground">
                Add a payment method to unlock all features.<br />
                <span className="font-medium text-foreground">You won't be charged until the trial ends.</span>
              </p>
            </div>

            {/* Benefits list */}
            <div className="space-y-3 mb-8">
              {TRIAL_BENEFITS.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-accent/10 flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-accent" />
                  </div>
                  <span className="text-sm text-foreground">{benefit.text}</span>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <Button
              onClick={handleStartTrial}
              className="w-full h-12 text-base font-medium"
              size="lg"
              disabled={createCheckout.isPending}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {createCheckout.isPending ? 'Redirecting to checkout...' : 'Start Free Trial'}
            </Button>

            {/* Pricing info */}
            <p className="text-xs text-muted-foreground text-center mt-4">
              After trial: $99/seat/month or $999/seat/year (save ~17%)
            </p>

            {/* Sign out option */}
            <div className="mt-6 pt-6 border-t border-border text-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Not ready yet? Sign out
              </Button>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-6 text-xs text-foreground/70 text-center">
            <nav className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/privacy" className="underline underline-offset-2 hover:no-underline">Privacy Policy</Link>
              <span aria-hidden="true">•</span>
              <Link to="/terms" className="underline underline-offset-2 hover:no-underline">Terms of Service</Link>
            </nav>
            <p className="mt-2">© {new Date().getFullYear()} GoGio</p>
          </footer>
        </div>
      </div>
    </div>
  )
}
