import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { OrgContextProvider } from './contexts/OrgContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useStartupDiagnostics } from './hooks/useStartupDiagnostics'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { log } from './lib/logger'
import { BillingGuard } from './components/auth/BillingGuard'
import Dashboard from './pages/Dashboard'
import Find from './pages/Find'
import Jobs from './pages/Jobs'
import Pipeline from './pages/Pipeline'
import JobDetail from './pages/JobDetail'
import Members from './pages/Members'
import Organizations from './pages/Organizations'
import Candidates from './pages/Candidates'
import Settings from './pages/Settings'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import AcceptInvite from './pages/AcceptInvite'
import VerifyEmail from './pages/VerifyEmail'
import { useAuth } from './contexts/AuthContext'
import { useOrgContext } from './contexts/OrgContext'
import { useRef, useEffect } from 'react'
import NotFound from './pages/NotFound'
import CandidateProfile from '@/pages/CandidateProfile'
import IndependentCandidateProfile from '@/pages/IndependentCandidateProfile'
import { useFavicon } from './hooks/useFavicon'
import { useBrowserTitle } from './hooks/useBrowserTitle'
import { Toaster } from '@/components/ui/toaster'
import { useAuthBootstrap } from './hooks/useAuthBootstrap'
import PublicJobPosting from './pages/PublicJobPosting'
import PublicBookingPage from './pages/PublicBookingPage'
import BookingConfirmed from './pages/BookingConfirmed'
import Onboarding from './pages/Onboarding'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import AuthCallback from './pages/AuthCallback'
import MailOAuthCallback from './pages/MailOAuthCallback'
import AccountSetup from './pages/AccountSetup'
import { SaaSCustomerDetail } from './pages/settings/saas-customers/SaaSCustomerDetail'
const queryClient = new QueryClient()

function AppContent() {
  // Initialize favicon and browser title loading
  useFavicon()
  useBrowserTitle()

  return (
    <div className="min-h-screen bg-background text-foreground">
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
        <Route path="/schedule/:shortCode" element={<PublicBookingPage />} />
        <Route path="/schedule/:shortCode/confirmed/:bookingId" element={<BookingConfirmed />} />

        {/* Authenticated routes wrapped with RequireAuth and Layout */}
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          {/* Always accessible routes - users need access to manage billing */}
          <Route path="/billing" element={<Settings />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/platform/saas-customers/:id" element={<SaaSCustomerDetail />} />
          <Route path="/account-setup" element={<AccountSetup />} />
          <Route path="/mail/oauth/callback" element={<MailOAuthCallback />} />
          <Route path="/onboarding" element={<Onboarding />} />
          
          {/* Protected routes - wrapped with BillingGuard */}
          <Route element={<BillingGuard requireActive={false} />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/find" element={<Find />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/jobs/:jobId/candidates/:candidateId" element={<CandidateProfile />} />
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/candidates/:candidateId" element={<IndependentCandidateProfile />} />
            <Route path="/members" element={<Members />} />
            <Route path="/organizations" element={<Navigate to="/settings?tab=organizations" replace />} />
          </Route>
        </Route>

        {/* 404 catch-all - must be last */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
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
