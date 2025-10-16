import React from 'react'
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'
import * as Sentry from '@sentry/react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  const isDev = import.meta.env.DEV

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
          <CardDescription>
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDev && (
            <div className="bg-muted p-4 rounded-md overflow-auto max-h-96">
              <p className="font-mono text-sm text-muted-foreground mb-2">Error Details (dev only):</p>
              <pre className="font-mono text-xs text-destructive whitespace-pre-wrap break-words">
                {error.message}
                {error.stack && `\n\nStack Trace:\n${error.stack}`}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  navigator.clipboard.writeText(`${error.message}\n\n${error.stack || ''}`)
                }}
              >
                Copy Error Details
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={resetErrorBoundary}>
              Try Again
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Go to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<ErrorFallbackProps>
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={fallback || ErrorFallback}
      onReset={() => {
        // Reset any state or reload the page
        window.location.reload()
      }}
      onError={(error, errorInfo) => {
        // Always log to console
        console.error('ErrorBoundary caught an error:', error, errorInfo)
        
        // Send to Sentry in production when DSN is configured
        if (!import.meta.env.DEV && import.meta.env.VITE_SENTRY_DSN) {
          Sentry.captureException(error, {
            contexts: {
              react: {
                componentStack: errorInfo.componentStack,
              },
            },
          })
        }
      }}
    >
      {children}
    </ReactErrorBoundary>
  )
}
