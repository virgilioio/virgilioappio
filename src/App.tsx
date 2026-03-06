import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
} from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { OrgContextProvider } from './contexts/OrgContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useStartupDiagnostics } from './hooks/useStartupDiagnostics'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { log } from './lib/logger'
import { BillingGuard } from './components/auth/BillingGuard'
import { useAuth } from './contexts/AuthContext'
import { useOrgContext } from './contexts/OrgContext'
import { lazy, Suspense, useRef, useEffect } from 'react'
import { useFavicon } from './hooks/useFavicon'
import { useBrowserTitle } from './hooks/useBrowserTitle'
import { Toaster } from '@/components/ui/toaster'
import { AppUpdateNotification } from '@/components/layout/AppUpdateNotification'
import { useAuthBootstrap } from './hooks/useAuthBootstrap'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Find = lazy(() => import('./pages/Find'))
const Jobs = lazy(() => import('./pages/Jobs'))
const Pipeline = lazy(() => import('./pages/Pipeline'))
const JobDetail = lazy(() => import('./pages/JobDetail'))
const Members = lazy(() => import('./pages/Members'))
const Candidates = lazy(() => import('./pages/Candidates'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))
const SignUp = lazy(() => import('./pages/SignUp'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const NotFound = lazy(() => import('./pages/NotFound'))
const CandidateProfile = lazy(() => import('@/pages/CandidateProfile'))
const IndependentCandidateProfile = lazy(() => import('@/pages/IndependentCandidateProfile'))

// Redirect component for legacy /candidates/:candidateId URLs
function CandidateRedirect() {
  const { candidateId } = useParams()
  return <Navigate to={`/candidates?openCandidate=${candidateId}`} replace />
}

const PublicJobPosting = lazy(() => import('./pages/PublicJobPosting'))
const PublicCareersPage = lazy(() => import('./pages/PublicCareersPage'))
const PublicBookingPage = lazy(() => import('./pages/PublicBookingPage'))
const BookingConfirmed = lazy(() => import('./pages/BookingConfirmed'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
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
const TalentInsights = lazy(() => import('./pages/TalentInsights'))
const queryClient = new QueryClient()

function AppContent() {
  // Initialize favicon and browser title loading
  useFavicon()
  useBrowserTitle()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }>
      <Routes>
        {/* Public routes - no authentication required */}
        <Route path="/auth" element={<Login />} />
        <Route path="/login" element={<Navigate to="/auth" replace />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/accept-invite/:token" element={<AcceptInvite />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/p/:slug" element={<PublicJobPosting />} />
        <Route path="/careers/:companySlug" element={<PublicCareersPage />} />
        <Route path="/schedule/:shortCode" element={<PublicBookingPage />} />
        <Route path="/schedule/:shortCode/confirmed/:bookingId" element={<BookingConfirmed />} />
        <Route path="/chrome-oauth/start" element={<ChromeOAuthStart />} />

        {/* Onboarding route - requires auth but NOT Layout (to bypass OrgGate) */}
        <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
        
        {/* Trial activation route - requires auth but accessible without org context */}
        <Route path="/trial-activation" element={<RequireAuth><TrialActivation /></RequireAuth>} />

        {/* Authenticated routes wrapped with RequireAuth and Layout */}
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          {/* Always accessible routes - users need access to manage billing */}
          <Route path="/billing" element={<Settings />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/platform/saas-customers/:id" element={<SaaSCustomerDetail />} />
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
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/talent-insights" element={<TalentInsights />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/jobs/:jobId/pipeline" element={<JobDetail />} />
            <Route path="/jobs/:jobId/candidates/:candidateId" element={<CandidateProfile />} />
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/candidates/:candidateId" element={<CandidateRedirect />} />
            <Route path="/members" element={<Members />} />
            <Route path="/organizations" element={<Navigate to="/settings?tab=organizations" replace />} />
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
  const { ready, session, orgContext } = useAuthBootstrap();

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Initializing authentication...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  // Run startup diagnostics in development
  useStartupDiagnostics()
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
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

  // 1. Show loader until session is ready
  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto"></div>
          <p className="text-muted-foreground">
            {isLoggingOut ? 'Signing out...' : 'Authenticating...'}
          </p>
        </div>
      </div>
    )
  }

  // 2. If not authenticated, redirect to auth
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  // 3. Show loader until orgContext is ready (unless platform admin)
  if (!orgContextReady && !isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    )
  }

  // 4. ONE GATE DECISION: Only RequireAuth redirects to /onboarding
  if (isPlatformAdmin) {
    return children
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
