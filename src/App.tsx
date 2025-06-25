
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
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import Members from './pages/Members'
import Organizations from './pages/Organizations'
import JobRequests from './pages/JobRequests'
import Candidates from './pages/Candidates'
import Settings from './pages/Settings'
import Login from './pages/Login'
import AcceptInvite from './pages/AcceptInvite'
import VerifyEmail from './pages/VerifyEmail'
import { useAuth } from './contexts/AuthContext'
import NotFound from './pages/NotFound'
import AdminInvoices from './pages/AdminInvoices'
import CandidateProfile from '@/pages/CandidateProfile'
import { useFavicon } from './hooks/useFavicon'
import { useBrowserTitle } from './hooks/useBrowserTitle'
import { Toaster } from '@/components/ui/toaster'

const queryClient = new QueryClient()

function AppContent() {
  // Initialize favicon and browser title loading
  useFavicon()
  useBrowserTitle()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Routes>
        <Route path="/auth" element={<Login />} />
        <Route path="/accept-invite/:token" element={<AcceptInvite />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
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
          <Route path="members" element={<Members />} />
          <Route path="organizations" element={<Organizations />} />
          <Route path="job-requests" element={<JobRequests />} />
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
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <div>Loading...</div> // Show a loading indicator while checking authentication
  }

  if (!isAuthenticated) {
    // Redirect to the auth page if not authenticated
    return <Navigate to="/auth" replace />
  }

  return children
}

export default App
