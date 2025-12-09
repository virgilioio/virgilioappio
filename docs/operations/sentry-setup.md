# Sentry Error Tracking Setup

**Purpose:** Production error tracking and monitoring for GoGio.io  
**Integration:** @sentry/react + @sentry/vite-plugin  
**Environment:** Production only (no-op in development)

---

## Required Environment Variables

### Runtime (Required for Sentry to activate)

```bash
# Sentry DSN (Data Source Name) - Get from Sentry project settings
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id

# Optional: Set app version for release tracking
VITE_APP_VERSION=1.0.0  # Defaults to 'unknown' if not set
```

### Build-time (Optional - for source map upload)

```bash
# Only needed if you want to upload source maps to Sentry
SENTRY_ORG=your-org-name
SENTRY_PROJECT=your-project-name
SENTRY_AUTH_TOKEN=your-auth-token
```

---

## How It Works

### 1. Initialization (`src/main.tsx`)

Sentry initializes **only when**:
- Not in development mode (`!import.meta.env.DEV`)
- AND `VITE_SENTRY_DSN` is set

```typescript
if (!import.meta.env.DEV && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,  // 10% performance monitoring
    // ... other config
  })
}
```

### 2. Error Boundary Integration (`src/components/ErrorBoundary.tsx`)

When React errors occur in production:
- Logs to console (always)
- Sends to Sentry (only in production with DSN set)

```typescript
public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  console.error("Uncaught error:", error, errorInfo);
  
  if (!import.meta.env.DEV && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureException(error, {
      contexts: { react: { componentStack: errorInfo.componentStack } }
    });
  }
}
```

### 3. Source Maps (`vite.config.ts`)

Production builds generate source maps:
- `build.sourcemap: true` - Always generates maps
- Sentry Vite plugin uploads maps (only when `SENTRY_AUTH_TOKEN` is set)

---

## Configuration Details

### Sample Rates

| Metric | Rate | Description |
|--------|------|-------------|
| `tracesSampleRate` | 0.1 (10%) | Performance monitoring sampling |
| `replaysSessionSampleRate` | 0.1 (10%) | General session replay rate |
| `replaysOnErrorSampleRate` | 1.0 (100%) | Always replay sessions with errors |

**Tuning:** Adjust these in `src/main.tsx` based on traffic and Sentry quota.

### Integrations Enabled

1. **Browser Tracing** - Performance monitoring
2. **Session Replay** - Visual reproduction of user sessions (masked for privacy)
   - All text masked
   - All media blocked

---

## Testing

### Development (Should NO-OP)

```bash
# No VITE_SENTRY_DSN set - Sentry will NOT initialize
npm run dev
```

**Expected:** No Sentry activity, errors only in console.

### Production Simulation (Local)

```bash
# Set DSN and build production
VITE_SENTRY_DSN=https://test-dsn@sentry.io/123 npm run build
npm run preview
```

**Expected:** 
1. Sentry initializes
2. Errors sent to Sentry dashboard
3. Source maps uploaded (if auth token set)

### Verify Integration

1. Navigate to app
2. Trigger an error (test error boundary)
3. Check Sentry dashboard for event
4. Verify stack trace is readable (source maps working)

---

## Production Deployment Checklist

- [ ] Set `VITE_SENTRY_DSN` in production environment
- [ ] (Optional) Set `VITE_APP_VERSION` to track releases
- [ ] (Optional) Set Sentry build vars for source map upload:
  - `SENTRY_ORG`
  - `SENTRY_PROJECT`
  - `SENTRY_AUTH_TOKEN`
- [ ] Run production build
- [ ] Verify source maps uploaded (check Sentry releases)
- [ ] Test error reporting in production
- [ ] Monitor quota usage in Sentry

---

## Troubleshooting

### Sentry Not Initializing

**Symptoms:** No events in Sentry dashboard

**Checks:**
1. Is `VITE_SENTRY_DSN` set? (Check `console.log(import.meta.env.VITE_SENTRY_DSN)`)
2. Is app running in production mode? (Check `import.meta.env.MODE`)
3. DSN format correct? Should start with `https://`

### Source Maps Not Working

**Symptoms:** Stack traces show minified code

**Checks:**
1. Are source maps being generated? (`build.sourcemap: true` in vite.config.ts)
2. Are build-time env vars set? (`SENTRY_AUTH_TOKEN`, etc.)
3. Check Sentry > Settings > Projects > [project] > Source Maps

### Too Many Events / Quota Exceeded

**Action:** Reduce sample rates in `src/main.tsx`:
- Lower `tracesSampleRate` (0.05 = 5%)
- Lower `replaysSessionSampleRate` (0.05 = 5%)

---

## Security Notes

- **DSN is public** - It's safe to expose in client code
- **Auth token is private** - Only use in secure CI/CD, never commit
- **User data** - Session replays are masked by default
- **Source maps** - Uploaded separately, not exposed to users

---

## References

- Sentry React Docs: https://docs.sentry.io/platforms/javascript/guides/react/
- Vite Plugin: https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/uploading/vite/
- Performance Monitoring: https://docs.sentry.io/platforms/javascript/performance/
- Session Replay: https://docs.sentry.io/platforms/javascript/session-replay/
