import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

/**
 * Development-only hook to diagnose session ↔ DB identity alignment
 * Logs session.user.id, whoami(), and resolve_org_context() on startup
 */
export function useStartupDiagnostics() {
  useEffect(() => {
    // Only run in development
    if (import.meta.env.MODE !== 'development') return

    const runDiagnostics = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user) {
          console.log('🔍 [Startup Diagnostics] No active session')
          return
        }

        // Call whoami RPC
        const { data: whoamiResult, error: whoamiError } = await supabase
          .rpc('whoami')

        // Call resolve_org_context RPC
        const { data: orgContext, error: orgError } = await supabase
          .rpc('resolve_org_context')

        // Log results
        console.group('🔍 [Startup Diagnostics]')
        console.log('Session User ID:', session.user.id)
        console.log('whoami() Result:', whoamiError ? `ERROR: ${whoamiError.message}` : whoamiResult)
        console.log('resolve_org_context():', orgError ? `ERROR: ${orgError.message}` : orgContext)
        
        // Verify identity match
        const identityMatches = !whoamiError && whoamiResult === session.user.id
        console.log(
          identityMatches 
            ? '✅ Identity Match: session.user.id === whoami()' 
            : '❌ Identity Mismatch: session and DB are out of sync'
        )

        // Log org context status
        if (!orgError && orgContext && Array.isArray(orgContext) && orgContext.length > 0) {
          const ctx = orgContext[0]
          if (ctx.user_type === 'platform_admin') {
            console.log('✅ Platform Admin: Org context bypass enabled')
          } else if (ctx.organization_id) {
            console.log(`✅ Organization Context: ${ctx.organization_id}`)
            console.log(`   Role: ${ctx.role}`)
            console.log(`   User Type: ${ctx.user_type}`)
          } else {
            console.log('⚠️  No Organization Context: User should see onboarding or workspace chooser')
          }
        } else if (!orgError) {
          console.log('⚠️  No Organization Context: Empty result from resolve_org_context')
        }
        
        console.groupEnd()
      } catch (error) {
        console.error('🔍 [Startup Diagnostics] Error:', error)
      }
    }

    // Run diagnostics after a short delay to ensure bootstrap completes
    const timeoutId = setTimeout(runDiagnostics, 500)
    
    return () => clearTimeout(timeoutId)
  }, [])
}
