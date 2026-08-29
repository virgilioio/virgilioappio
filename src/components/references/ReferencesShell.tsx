import type { ReactNode } from 'react'

/**
 * Page root for every /references* screen. The app chrome (icon rail + the
 * single dark floating AppHeader with the module's Requests/Templates tabs)
 * is supplied by Layout — this only owns the content inset.
 */
export function ReferencesShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100%', background: '#F6F5F1', padding: '24px 28px' }}>
      {children}
    </div>
  )
}

export function ReferencesNoAccess() {
  return (
    <div className="h-[100dvh] flex items-center justify-center">
      <p className="text-sm text-muted-foreground">You don't have access to Reference checks.</p>
    </div>
  )
}
