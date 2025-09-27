
import { AuthGate } from '@/components/auth/AuthGate'
import { OrgGate } from '@/components/auth/OrgGate'
import { Header } from './Header'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const billing = params.get('billing')

    const runRefresh = async () => {
      try {
        await Promise.allSettled([
          supabase.functions.invoke('check-subscription'),
          supabase.functions.invoke('update-seat-quantity'),
        ])
        queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] })
      } catch (e) {
        console.warn('[Layout] post-billing refresh failed', e)
      }
    }

    if (billing === 'success') {
      toast({ title: 'Billing updated', description: 'Your subscription was updated successfully.' })
      runRefresh()
      // Clean the query param to prevent repeated toasts
      const next = new URLSearchParams(location.search)
      next.delete('billing')
      navigate({ pathname: location.pathname, search: next.toString() }, { replace: true })
    } else if (billing === 'cancel') {
      toast({ title: 'Checkout canceled', description: 'You canceled the billing process.', variant: 'destructive' })
      const next = new URLSearchParams(location.search)
      next.delete('billing')
      navigate({ pathname: location.pathname, search: next.toString() }, { replace: true })
    }
  }, [location.pathname, location.search, navigate, toast, queryClient])

  return (
    <AuthGate>
      <OrgGate>
        <div className="bg-background">
          <Header />
          <main className="min-h-[calc(100vh-3rem)] sm:min-h-[calc(100vh-3.5rem)]">
            <Outlet />
          </main>
        </div>
      </OrgGate>
    </AuthGate>
  )
}
