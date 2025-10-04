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
import Dashboard from './pages/Dashboard'
import Jobs from './pages/Jobs'
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
import NotFound from './pages/NotFound'
import CandidateProfile from '@/pages/CandidateProfile'
import IndependentCandidateProfile from '@/pages/IndependentCandidateProfile'
import { useFavicon } from './hooks/useFavicon'
import { useBrowserTitle } from './hooks/useBrowserTitle'
import { Toaster } from '@/components/ui/toaster'
import { useAuthBootstrap } from './hooks/useAuthBootstrap'
import PublicJobPosting from './pages/PublicJobPosting'
import Onboarding from './pages/Onboarding'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import AuthCallback from './pages/AuthCallback'
import { SaaSCustomerDetail } from './pages/settings/saas-customers/SaaSCustomerDetail'
const queryClient = new QueryClient()

function AppContent() {
  // Initialize favicon and browser title loading
  useFavicon()
  useBrowserTitle()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Routes>
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
        {/* Public job posting route */}
        <Route path="/p/:slug" element={<PublicJobPosting />} />
        {/* Onboarding for authenticated users without org context */}
        <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          
          <Route path="jobs" element={<Jobs />} />
          <Route path="jobs/:id" element={<JobDetail />} />
          <Route path="jobs/:jobId/candidates/:candidateId" element={<CandidateProfile />} />
          <Route path="candidates" element={<Candidates />} />
          <Route path="candidates/:candidateId" element={<IndependentCandidateProfile />} />
          <Route path="members" element={<Members />} />
          <Route path="organizations" element={<Navigate to="/settings?tab=organizations" replace />} />
          
          <Route path="billing" element={<Settings />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/platform/saas-customers/:id" element={<SaaSCustomerDetail />} />
          <Route path="*" element={<NotFound />} />
        </Route>
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
    <QueryClientProvider client={queryClient}>
      <AppBootstrap>
        <AuthProvider>
          <OrgContextProvider>
            <Router>
              <AppContent />
            </Router>
          </OrgContextProvider>
        </AuthProvider>
      </AppBootstrap>
    </QueryClientProvider>
  )
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading: authLoading, userType } = useAuth()
  const { isLoading: orgLoading, hasOrganizationContext } = useOrgContext()
  const location = window.location

  // Block UI until auth is ready
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  // Platform admins bypass org context requirement entirely
  const isPlatformAdmin = userType === 'platform_admin'
  
  // Block UI until org context is ready (unless platform admin)
  if (!isPlatformAdmin && orgLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    )
  }

  // Platform admins don't need organization context - render immediately
  if (isPlatformAdmin) {
    return children
  }

  // Regular users without org context can access onboarding
  if (!hasOrganizationContext && location.pathname === '/onboarding') {
    return children
  }

  // Regular users without org context redirected to onboarding
  if (!hasOrganizationContext) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}

export default App
