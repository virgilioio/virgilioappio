
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import PeopleHub from './pages/PeopleHub'
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
import NotFound from './pages/NotFound'
import AdminInvoices from './pages/AdminInvoices'
import CandidateProfile from '@/pages/CandidateProfile'
import IndependentCandidateProfile from '@/pages/IndependentCandidateProfile'
import { useFavicon } from './hooks/useFavicon'
import { useBrowserTitle } from './hooks/useBrowserTitle'
import { Toaster } from '@/components/ui/toaster'
import PublicJobPosting from './pages/PublicJobPosting'
import Onboarding from './pages/Onboarding'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import AuthCallback from './pages/AuthCallback'
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
          <Route path="people-hub/*" element={<PeopleHub />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="jobs/:id" element={<JobDetail />} />
          <Route path="jobs/:jobId/candidates/:candidateId" element={<CandidateProfile />} />
          <Route path="candidates" element={<Candidates />} />
          <Route path="candidates/:candidateId" element={<IndependentCandidateProfile />} />
          <Route path="members" element={<Members />} />
          <Route path="organizations" element={<Organizations />} />
          
          <Route path="billing" element={<Settings />} />
          <Route path="invoices" element={<AdminInvoices />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster />
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading, hasOrganizationContext } = useAuth()
  const location = window.location

  if (isLoading) {
    return <div>Loading...</div> // Show a loading indicator while checking authentication
  }

  if (!isAuthenticated) {
    // Redirect to the auth page if not authenticated
    return <Navigate to="/auth" replace />
  }

  // Redirect authenticated users without org context to onboarding, except when already there or on public routes
  if (!hasOrganizationContext && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return children
}

export default App
