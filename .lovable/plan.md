

# Route-Level Code Splitting and Sentry Optimization

## 1. Route-Level Code Splitting (`src/App.tsx`)

Replace all 27 eager page imports (lines 15-54) with `React.lazy` calls, and add a `Suspense` wrapper around `Routes`. The routing logic stays identical.

### Lazy imports (replacing lines 15-54)

```typescript
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
const Analytics = lazy(() => import('./pages/Analytics'))
```

The `SaaSCustomerDetail` named export needs a wrapper:
```typescript
const SaaSCustomerDetail = lazy(() =>
  import('./pages/settings/saas-customers/SaaSCustomerDetail').then(m => ({ default: m.SaaSCustomerDetail }))
)
```

### Update React import (line 32)

Change `import { useRef, useEffect } from 'react'` to:
```typescript
import { lazy, Suspense, useRef, useEffect } from 'react'
```

### Add Suspense fallback

Wrap the `<Routes>` block inside `AppContent` with:
```tsx
<Suspense fallback={
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
}>
  <Routes>
    ...unchanged...
  </Routes>
</Suspense>
```

Remove the now-unused `Organizations` import (it's only used as `<Navigate>`, never rendered).

## 2. Sentry Dynamic Import (`src/main.tsx`)

Remove the top-level `import * as Sentry` and dynamically import it only when needed:

```typescript
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Dynamically import and init Sentry only in production
if (!import.meta.env.DEV && import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      release: import.meta.env.VITE_APP_VERSION || 'unknown',
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    })
  })
}

createRoot(document.getElementById("root")!).render(<App />);
```

Note: `src/components/ErrorBoundary.tsx` also imports `@sentry/react` statically. That import stays as-is -- it's tree-shaken in dev builds anyway since `Sentry.captureException` is a no-op without init. The main win is removing Sentry from the critical entry chunk.

## Summary

| File | Changes |
|------|---------|
| `src/App.tsx` | Replace 27 eager page imports with `React.lazy`, add `Suspense` wrapper, add `lazy`/`Suspense` to React import, remove unused `Organizations` import |
| `src/main.tsx` | Replace static `import * as Sentry` with dynamic `import('@sentry/react').then(...)` |

No routing logic changes. No editor/component logic changes.

