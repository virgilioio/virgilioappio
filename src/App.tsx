import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import Members from './pages/Members'
import Organizations from './pages/Organizations'
import JobRequests from './pages/JobRequests'
import Billing from './pages/Billing'
import Settings from './pages/Settings'
import Auth from './pages/Auth'
import { useAuth } from './contexts/AuthContext'
import NotFound from './pages/NotFound'
import Invoices from './pages/Invoices'
import Pricing from './pages/Pricing'
import Onboarding from './pages/Onboarding'
import CandidateProfile from '@/pages/CandidateProfile'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-background text-foreground">
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/jobs"
                element={
                  <RequireAuth>
                    <Jobs />
                  </RequireAuth>
                }
              />
              <Route
                path="/jobs/:id"
                element={
                  <RequireAuth>
                    <JobDetail />
                  </RequireAuth>
                }
              />
              <Route
                path="/members"
                element={
                  <RequireAuth>
                    <Members />
                  </RequireAuth>
                }
              />
              <Route
                path="/organizations"
                element={
                  <RequireAuth>
                    <Organizations />
                  </RequireAuth>
                }
              />
              <Route
                path="/job-requests"
                element={
                  <RequireAuth>
                    <JobRequests />
                  </RequireAuth>
                }
              />
              <Route
                path="/billing"
                element={
                  <RequireAuth>
                    <Billing />
                  </RequireAuth>
                }
              />
              <Route
                path="/invoices"
                element={
                  <RequireAuth>
                    <Invoices />
                  </RequireAuth>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <Settings />
                  </RequireAuth>
                }
              />
              <Route
                path="/onboarding"
                element={
                  <RequireAuth>
                    <Onboarding />
                  </RequireAuth>
                }
              />
              <Route path="/jobs/:jobId/candidates/:candidateId" element={<CandidateProfile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
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
