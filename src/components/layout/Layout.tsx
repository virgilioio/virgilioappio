
import { AuthGate } from '@/components/auth/AuthGate'
import { OrgGate } from '@/components/auth/OrgGate'
import { Header } from './Header'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const billing = params.get('billing')
    const sessionId = params.get('session_id')
    const canceled = params.get('canceled')

    const runRefresh = async () => {
      try {
        await Promise.allSettled([
          supabase.functions.invoke('check-subscription'),
          supabase.functions.invoke('update-seat-quantity'),
        ])
        queryClient.invalidateQueries({ queryKey: ['billing-status'] })
        queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] })
      } catch (e) {
        console.warn('[Layout] post-billing refresh failed', e)
      }
    }

    if (billing === 'success' && sessionId) {
      toast({ 
        title: 'Subscription activated', 
        description: 'Welcome to Virgilio! Your subscription is now active.',
        variant: 'default'
      })
      runRefresh()
      
      // Clean query params
      const next = new URLSearchParams(location.search)
      next.delete('billing')
      next.delete('session_id')
      navigate({ pathname: location.pathname, search: next.toString() }, { replace: true })
    } else if (canceled === 'true') {
      toast({ 
        title: 'Checkout canceled', 
        description: 'You can subscribe anytime from Settings.',
        variant: 'default'
      })
      
      // Clean query params
      const next = new URLSearchParams(location.search)
      next.delete('canceled')
      navigate({ pathname: location.pathname, search: next.toString() }, { replace: true })
    }
  }, [location.pathname, location.search, navigate, toast, queryClient])

  return (
    <AuthGate>
      <OrgGate>
        <div className="bg-background">
          <Header />
          <main className="pt-12 sm:pt-14 min-h-[calc(100vh-6rem)] sm:min-h-[calc(100vh-7rem)]">
            <Outlet />
          </main>
        </div>
      </OrgGate>
    </AuthGate>
  )
}
