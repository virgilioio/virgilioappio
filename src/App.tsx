import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { OrgContextProvider } from './contexts/OrgContext'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { persister, shouldPersistQueryKey, CACHE_VERSION } from '@/lib/cache/persister'
import { useStartupDiagnostics } from './hooks/useStartupDiagnostics'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { log } from './lib/logger'
import { BillingGuard } from './components/auth/BillingGuard'
import { SettingsLockGuard } from './components/auth/SettingsLockGuard'
import { useAuth } from './contexts/AuthContext'
import { useOrgContext } from './contexts/OrgContext'
import { lazy, Suspense, useRef, useEffect } from 'react'
import { DeactivatedWall } from '@/components/auth/DeactivatedWall'
import { useFavicon } from './hooks/useFavicon'
import { useBrowserTitle } from './hooks/useBrowserTitle'
import { Toaster } from '@/components/ui/toaster'
import { AppUpdateNotification } from '@/components/layout/AppUpdateNotification'
import { useAuthBootstrap } from './hooks/useAuthBootstrap'
import { useReportSplashReady } from './contexts/SplashReadyContext'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Find = lazy(() => import('./pages/Find'))
const Jobs = lazy(() => import('./pages/Jobs'))
const CRM = lazy(() => import('./pages/CRM'))
const Deals = lazy(() => import('./pages/Deals'))
const Pipeline = lazy(() => import('./pages/Pipeline'))
const Calendar = lazy(() => import('./pages/Calendar'))
const JobDetail = lazy(() => import('./pages/JobDetail'))
const Members = lazy(() => import('./pages/Members'))
const Candidates = lazy(() => import('./pages/Candidates'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))
const SignUp = lazy(() => import('./pages/SignUp'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'))

const NotFound = lazy(() => import('./pages/NotFound'))
const CandidateProfile = lazy(() => import('@/pages/CandidateProfile'))
const IndependentCandidateProfile = lazy(() => import('@/pages/IndependentCandidateProfile'))


const PublicJobPosting = lazy(() => import('./pages/PublicJobPosting'))
const PublicCareersPage = lazy(() => import('./pages/PublicCareersPage'))
const VirgilioCareersPage = lazy(() => import('./pages/VirgilioCareersPage'))
const LegacyPostingRedirect = lazy(() => import('./pages/LegacyPostingRedirect'))
const PublicBookingPage = lazy(() => import('./pages/PublicBookingPage'))
const BookingConfirmed = lazy(() => import('./pages/BookingConfirmed'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const OnboardingPreview = lazy(() => import('./pages/dev/OnboardingPreview'))
const TrialActivation = lazy(() => import('./pages/TrialActivation'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const MailOAuthCallback = lazy(() => import('./pages/MailOAuthCallback'))
const ChromeOAuthStart = lazy(() => import('./pages/ChromeOAuthStart'))
const AccountSetup = lazy(() => import('./pages/AccountSetup'))
const SaaSCustomerDetail = lazy(() =>
  import('./pages/settings/saas-customers/SaaSCustomerDetail').then(m => ({ default: m.SaaSCustomerDetail }))
)
const Analytics = lazy(() => import('./pages/Analytics'))

const TalentIntelligence = lazy(() => import('./pages/TalentIntelligence'))
const SharedList = lazy(() => import('./pages/SharedList'))
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      retry: 1,
    },
  },
})

// Expose for non-React contexts (sign-out, tenant switch).
if (typeof window !== 'undefined') {
  ;(window as unknown as { __queryClient?: QueryClient }).__queryClient = queryClient
}

function AppContent() {
  // Initialize favicon and browser title loading
  useFavicon()
  useBrowserTitle()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense fallback={null}>

      <Routes>
        {/* Public routes - no authentication required */}
        <Route path="/auth" element={<Login />} />
        <Route path="/login" element={<Navigate to="/auth" replace />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/accept-invite/:token" element={<AcceptInvite />} />
        
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/p/:slug" element={<LegacyPostingRedirect />} />
        <Route path="/careers/:companySlug" element={<PublicCareersPage />} />
        <Route path="/careers/:companySlug/:postingSlug" element={<PublicJobPosting />} />
        <Route path="/virgilio-careers" element={<VirgilioCareersPage />} />
        <Route path="/virgilio-careers/:postingSlug" element={<PublicJobPosting />} />
        <Route path="/schedule/:shortCode" element={<PublicBookingPage />} />
        <Route path="/schedule/:shortCode/:eventSlug" element={<PublicBookingPage />} />
        <Route path="/schedule/:shortCode/confirmed/:bookingId" element={<BookingConfirmed />} />
        <Route path="/chrome-oauth/start" element={<ChromeOAuthStart />} />

        {/* Onboarding route - requires auth but NOT Layout (to bypass OrgGate) */}
        <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
        {/* Dev-only preview of the onboarding flow (no auth, all backend stubbed) */}
        <Route path="/__preview/onboarding" element={<OnboardingPreview />} />

        
        
        {/* Trial activation route - requires auth but accessible without org context */}
        <Route path="/trial-activation" element={<RequireAuth><TrialActivation /></RequireAuth>} />

        {/* Authenticated routes wrapped with RequireAuth and Layout */}
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          {/* Always accessible routes - users need access to manage billing.
              SettingsLockGuard still locks them out when billing_status === 'locked'. */}
          <Route element={<SettingsLockGuard />}>
            <Route path="/billing" element={<Settings />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/platform/saas-customers/:id" element={<SaaSCustomerDetail />} />
          </Route>
          <Route path="/account-setup" element={<AccountSetup />} />
          <Route path="/mail/oauth/callback" element={<MailOAuthCallback />} />
          
          {/* Protected routes - wrapped with BillingGuard */}
          <Route element={<BillingGuard requireActive={false} />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/find" element={<Find />} />
            <Route path="/find/:projectId" element={<Find />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/insights" element={<Navigate to="/analytics" replace />} />
            <Route path="/talent-intelligence" element={<TalentIntelligence />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/jobs/:jobId/pipeline" element={<JobDetail />} />
            <Route path="/jobs/:jobId/candidates/:candidateId" element={<CandidateProfile />} />
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/candidates/:candidateId" element={<IndependentCandidateProfile />} />
            <Route path="/lists/:id" element={<SharedList />} />
            <Route path="/members" element={<Members />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/crm/deals" element={<Deals />} />
            <Route path="/organizations" element={<Navigate to="/crm" replace />} />
          </Route>
        </Route>

        {/* 404 catch-all - must be last */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      <Toaster />
      <AppUpdateNotification />
    </div>
  )
}

function AppBootstrap({ children }: { children: React.ReactNode }) {
  const { ready, session } = useAuthBootstrap();

  // Mark splash ready as soon as auth bootstrap settles AND there's no session
  // (signed-out path — no org context to wait for).
  useReportSplashReady(ready && !session);

  if (!ready) {
    // GioSplash covers cold-load; render nothing here so the splash sits on top.
    return null;
  }

  return <>{children}</>;
}


function App() {
  // Run startup diagnostics in development
  useStartupDiagnostics()
  
  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 24 * 60 * 60 * 1000,
          buster: CACHE_VERSION,
          dehydrateOptions: {
            shouldDehydrateQuery: (query) =>
              query.state.status === 'success' && shouldPersistQueryKey(query.queryKey),
          },
        }}
      >
        <AppBootstrap>
          <AuthProvider>
            <OrgContextProvider>
              <Router>
                <ErrorBoundary>
                  <AppContent />
                </ErrorBoundary>
              </Router>
            </OrgContextProvider>
          </AuthProvider>
        </AppBootstrap>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  )
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading: authLoading, userTypeLoading, userType, isLoggingOut } = useAuth()
  const { isLoading: orgLoading, hasOrganizationContext } = useOrgContext()
  const isPlatformAdmin = userType === 'platform_admin'

  // Derived ready states
  const sessionReady = !authLoading && !isLoggingOut
  const orgContextReady = !userTypeLoading && !orgLoading

  // Report to the cold-load splash as soon as everything we need is settled.
  useReportSplashReady(sessionReady && (orgContextReady || isPlatformAdmin))

  // ONE-TIME dev trace when decision is ready
  const traceRef = useRef(false)
  useEffect(() => {
    if (!traceRef.current && sessionReady && (orgContextReady || isPlatformAdmin)) {
      traceRef.current = true
      log.debug('[RequireAuth] Decision ready:', {
        isAuthenticated,
        sessionReady,
        orgContextReady,
        isPlatformAdmin,
        hasOrg: hasOrganizationContext,
        path: window.location.pathname,
      })
    }
  }, [sessionReady, orgContextReady, isPlatformAdmin, hasOrganizationContext, isAuthenticated])

  // 1. Wait for session — GioSplash covers cold-load; in-session sign-outs render nothing briefly.
  if (!sessionReady) {
    return null
  }

  // 2. If not authenticated, redirect to auth
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  // 3. Wait for orgContext (unless platform admin) — splash/blank covers this.
  if (!orgContextReady && !isPlatformAdmin) {
    return null
  }


  // 4. ONE GATE DECISION: Only RequireAuth redirects to /onboarding
  if (isPlatformAdmin) {
    return children
  }

  // 🚫 Deactivated users see a clear wall instead of onboarding
  if (userType === 'deactivated') {
    return <DeactivatedWall />
  }

  if (hasOrganizationContext) {
    return children
  }

  // No org → redirect to onboarding (ONLY place this happens)
  if (window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return children
}

export default App
