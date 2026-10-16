import { installAutoTitle } from '@/lib/autoTitle'
import { PhoneSwitch, DesktopOnly } from '@/components/phone/PhoneSwitch'
import { OfflineBanner } from '@/components/layout/OfflineBanner'
import { ConfirmDialogHost } from '@/components/ui/confirm-dialog'
import { CloseJobRejectHost } from '@/components/jobs/CloseJobRejectHost'
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
import { NoWorkspaceWall } from '@/components/auth/NoWorkspaceWall'
import { OsAdminOnly } from '@/components/os/OsAdminOnly'
import { TalentPoolOnly } from '@/components/auth/TalentPoolOnly'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppUpdateNotification } from '@/components/layout/AppUpdateNotification'
import { useAuthBootstrap } from './hooks/useAuthBootstrap'
import { useReportSplashReady } from './contexts/SplashReadyContext'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Find = lazy(() => import('./pages/Find'))
const Jobs = lazy(() => import('./pages/Jobs'))
const Pipeline = lazy(() => import('./pages/Pipeline'))
const Calendar = lazy(() => import('./pages/Calendar'))
const JobDetail = lazy(() => import('./pages/JobDetail'))
const ApplicationReviewPage = lazy(() => import('./pages/ApplicationReview'))

const Members = lazy(() => import('./pages/Members'))
const Candidates = lazy(() => import('./pages/Candidates'))
const Chat = lazy(() => import('./pages/Chat'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'))

const NotFound = lazy(() => import('./pages/NotFound'))
const CandidateProfile = lazy(() => import('@/pages/CandidateProfile'))
const SuggestedCandidateProfile = lazy(() => import('@/pages/SuggestedCandidateProfile'))
const ReferenceRequestDetail = lazy(() => import('@/pages/ReferenceRequestDetail'))
const CandidateReferences = lazy(() => import('@/pages/CandidateReferences'))
const IndependentCandidateProfile = lazy(() => import('@/pages/IndependentCandidateProfile'))


const PublicJobPosting = lazy(() => import('./pages/PublicJobPosting'))
const PublicCareersPage = lazy(() => import('./pages/PublicCareersPage'))
const VirgilioCareersPage = lazy(() => import('./pages/VirgilioCareersPage'))
const LegacyPostingRedirect = lazy(() => import('./pages/LegacyPostingRedirect'))
const PublicBookingPage = lazy(() => import('./pages/PublicBookingPage'))
const BookingConfirmed = lazy(() => import('./pages/BookingConfirmed'))
const CandidateChat = lazy(() => import('./pages/CandidateChat'))
const PublicReferenceSubmit = lazy(() => import('./pages/PublicReferenceSubmit'))
const PublicReferenceAnswer = lazy(() => import('./pages/PublicReferenceAnswer'))
const PublicReferenceReport = lazy(() => import('./pages/PublicReferenceReport'))
const OnboardingPreview = lazy(() => import('./pages/dev/OnboardingPreview'))
const TrialActivation = lazy(() => import('./pages/TrialActivation'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const PrivacyChoice = lazy(() => import('./pages/PrivacyChoice'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const MailOAuthCallback = lazy(() => import('./pages/MailOAuthCallback'))
const ChromeOAuthStart = lazy(() => import('./pages/ChromeOAuthStart'))
const AccountSetup = lazy(() => import('./pages/AccountSetup'))
const SaaSCustomerDetail = lazy(() =>
  import('./pages/settings/saas-customers/SaaSCustomerDetail').then(m => ({ default: m.SaaSCustomerDetail }))
)
const Analytics = lazy(() => import('./pages/Analytics'))
const References = lazy(() => import('./pages/References'))
const OsPeople = lazy(() => import('./pages/os/People'))
const OsPersonDetail = lazy(() => import('./pages/os/PersonDetail'))
const OsJobRoles = lazy(() => import('./pages/os/JobRoles'))
const OsHistory = lazy(() => import('./pages/os/History'))
const SignEnvelopes = lazy(() => import('./pages/sign/Envelopes'))
const SignTemplates = lazy(() => import('./pages/sign/Templates'))
const ReferenceTemplates = lazy(() => import('./pages/ReferenceTemplates'))
const ReferenceTemplateEditor = lazy(() => import('./pages/ReferenceTemplateEditor'))

const TalentIntelligence = lazy(() => import('./pages/TalentIntelligence'))
// Phone versions (2026-10-12): the consulting tool for the road.
const PhoneCalendar = lazy(() => import('./components/phone/PhoneCalendar'))
const PhoneCandidates = lazy(() => import('./components/phone/PhoneCandidates'))
const PhoneCandidateGlance = lazy(() => import('./components/phone/PhoneCandidateGlance'))
const PhoneJobs = lazy(() => import('./components/phone/PhoneJobs'))
const PhoneJobGlance = lazy(() => import('./components/phone/PhoneJobGlance'))
const SharedList = lazy(() => import('./pages/SharedList'))
const PublicDossier = lazy(() => import('./pages/PublicDossier'))
const PublicPipeline = lazy(() => import('./pages/PublicPipeline'))
const OAuthConsent = lazy(() => import('./pages/OAuthConsent'))
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


// Step 1.2 — gate /chat behind canUseChat
import { useCanUseChat } from '@/hooks/usePermissions'
function ChatRouteGuard({ children }: { children: React.ReactNode }) {
  const canUseChat = useCanUseChat()
  if (!canUseChat) return <NotFound />
  return <>{children}</>
}

function AppContent() {
  // §10/§14: truncated text shows its full value in a tooltip while it's cut.
  useEffect(() => installAutoTitle(), [])



  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense fallback={null}>

      <Routes>
        {/* Public routes - no authentication required */}
        <Route path="/auth" element={<Login />} />
        <Route path="/login" element={<Navigate to="/auth" replace />} />
        {/* Invite-only since 2026-10-14: no public sign-up. */}
        <Route path="/signup" element={<Navigate to="/auth" replace />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/accept-invite/:token" element={<AcceptInvite />} />
        
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy/choice/:token" element={<PrivacyChoice />} />
        <Route path="/p/:slug" element={<LegacyPostingRedirect />} />
        <Route path="/careers/:companySlug" element={<PublicCareersPage />} />
        <Route path="/careers/:companySlug/:postingSlug" element={<PublicJobPosting />} />
        <Route path="/virgilio-careers" element={<VirgilioCareersPage />} />
        <Route path="/virgilio-careers/:postingSlug" element={<PublicJobPosting />} />
        <Route path="/schedule/:shortCode" element={<PublicBookingPage />} />
        <Route path="/schedule/:shortCode/:eventSlug" element={<PublicBookingPage />} />
        <Route path="/schedule/:shortCode/confirmed/:bookingId" element={<BookingConfirmed />} />
        <Route path="/chrome-oauth/start" element={<ChromeOAuthStart />} />
        {/* Google Workspace consent returns here; public — the sealed state identifies the user. */}
        <Route path="/mail/oauth/callback" element={<MailOAuthCallback />} />
        <Route path="/c/chat/:token" element={<CandidateChat />} />
        <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
        {/* Public reference-check pages — token-resolved, no account.
            The static /references app routes still win by static-over-dynamic ranking. */}
        <Route path="/references/:token" element={<PublicReferenceSubmit />} />
        <Route path="/reference/:token" element={<PublicReferenceAnswer />} />
        <Route path="/report/:token" element={<PublicReferenceReport />} />
        <Route path="/reference-report/:token" element={<PublicReferenceReport />} />
        {/* Public candidate dossier — always client-ready, resolved server-side. */}
        <Route path="/d/:token" element={<PublicDossier />} />
        <Route path="/cp/:token" element={<PublicPipeline />} />
        <Route path="/cp/:token/:slug" element={<PublicPipeline />} />


        {/* Signed in without a workspace: invite-only, so no self-serve workspace. */}
        <Route path="/onboarding" element={<RequireAuth><NoWorkspaceWall /></RequireAuth>} />
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
          
          {/* Protected routes - wrapped with BillingGuard */}
          <Route element={<BillingGuard requireActive={false} />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/find" element={<TalentPoolOnly what="Find"><Find /></TalentPoolOnly>} />
            <Route path="/find/:projectId" element={<Find />} />
            <Route path="/jobs" element={<PhoneSwitch phone={<PhoneJobs />}><Jobs /></PhoneSwitch>} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/calendar" element={<PhoneSwitch phone={<PhoneCalendar />}><Calendar /></PhoneSwitch>} />
            <Route path="/analytics" element={<PhoneSwitch phone={<DesktopOnly what="Analytics" />}><TalentPoolOnly what="Analytics"><Analytics /></TalentPoolOnly></PhoneSwitch>} />
            <Route path="/insights" element={<Navigate to="/analytics" replace />} />
            <Route path="/talent-intelligence" element={<PhoneSwitch phone={<DesktopOnly what="Intelligence" />}><TalentPoolOnly what="Intelligence"><TalentIntelligence /></TalentPoolOnly></PhoneSwitch>} />
            <Route path="/jobs/:id" element={<PhoneSwitch phone={<PhoneJobGlance />}><JobDetail /></PhoneSwitch>} />
            <Route path="/jobs/:jobId/pipeline" element={<PhoneSwitch phone={<PhoneJobGlance />}><JobDetail /></PhoneSwitch>} />
            <Route path="/jobs/:jobId/setup" element={<JobDetail />} />
            <Route path="/jobs/:jobId/review" element={<ApplicationReviewPage />} />
            <Route path="/jobs/:jobId/candidates/:candidateId" element={<PhoneSwitch phone={<PhoneCandidateGlance />}><CandidateProfile /></PhoneSwitch>} />
            <Route path="/jobs/:jobId/suggested/:candidateId" element={<SuggestedCandidateProfile />} />

            <Route path="/candidates" element={<TalentPoolOnly what="Candidates"><PhoneSwitch phone={<PhoneCandidates />}><Candidates /></PhoneSwitch></TalentPoolOnly>} />
            <Route path="/candidates/:candidateId" element={<PhoneSwitch phone={<PhoneCandidateGlance />}><IndependentCandidateProfile /></PhoneSwitch>} />
            <Route path="/lists/:id" element={<SharedList />} />
            <Route path="/members" element={<Members />} />
            <Route path="/crm/*" element={<Navigate to="/" replace />} />
            <Route path="/organizations" element={<Navigate to="/settings" replace />} />
            <Route path="/chat" element={<PhoneSwitch phone={<DesktopOnly what="Chat" />}><ChatRouteGuard><Chat /></ChatRouteGuard></PhoneSwitch>} />
            <Route path="/chat/:threadId" element={<PhoneSwitch phone={<DesktopOnly what="Chat" />}><ChatRouteGuard><Chat /></ChatRouteGuard></PhoneSwitch>} />
            <Route path="/references" element={<TalentPoolOnly what="Reference checks"><References /></TalentPoolOnly>} />
            <Route path="/references/requests/:requestId" element={<ReferenceRequestDetail />} />
            <Route path="/candidates/:candidateId/references" element={<CandidateReferences />} />
            <Route path="/references/templates" element={<ReferenceTemplates />} />
            <Route path="/references/templates/:id" element={<ReferenceTemplateEditor />} />
            {/* Gio OS: People & Access (admins and platform admins) */}
            <Route path="/os" element={<Navigate to="/os/people" replace />} />
            <Route path="/os/people" element={<PhoneSwitch phone={<DesktopOnly what="People & Access" />}><OsAdminOnly><OsPeople /></OsAdminOnly></PhoneSwitch>} />
            <Route path="/os/people/:memberId" element={<PhoneSwitch phone={<DesktopOnly what="People & Access" />}><OsAdminOnly><OsPersonDetail /></OsAdminOnly></PhoneSwitch>} />
            <Route path="/os/job-roles" element={<PhoneSwitch phone={<DesktopOnly what="People & Access" />}><OsAdminOnly><OsJobRoles /></OsAdminOnly></PhoneSwitch>} />
            <Route path="/os/history" element={<PhoneSwitch phone={<DesktopOnly what="People & Access" />}><OsAdminOnly><OsHistory /></OsAdminOnly></PhoneSwitch>} />
            <Route path="/sign" element={<PhoneSwitch phone={<DesktopOnly what="Sign" />}><OsAdminOnly><SignEnvelopes /></OsAdminOnly></PhoneSwitch>} />
            <Route path="/sign/templates" element={<PhoneSwitch phone={<DesktopOnly what="Sign" />}><OsAdminOnly><SignTemplates /></OsAdminOnly></PhoneSwitch>} />

          </Route>
        </Route>

        {/* 404 catch-all - must be last */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      <Sonner />
      <ConfirmDialogHost />
      <CloseJobRejectHost />
      <OfflineBanner />
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
            // Maps and Sets don't survive JSON: restored, they'd come back as
            // plain objects and crash whatever calls .get / .has (2026-10-14).
            shouldDehydrateQuery: (query) =>
              query.state.status === 'success' && shouldPersistQueryKey(query.queryKey)
              && !(query.state.data instanceof Map) && !(query.state.data instanceof Set),
          },
        }}
      >
        <AppBootstrap>
          <AuthProvider>
            <OrgContextProvider>
              <TooltipProvider>
                <Router>
                  <ErrorBoundary>
                    <AppContent />
                  </ErrorBoundary>
                </Router>
              </TooltipProvider>
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
