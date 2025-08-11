
import { AuthGate } from '@/components/auth/AuthGate'
import { OrgGate } from '@/components/auth/OrgGate'
import { Header } from './Header'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useToast } from '@/components/ui/use-toast'

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const billing = params.get('billing')
    if (billing === 'success') {
      toast({ title: 'Billing updated', description: 'Your subscription was updated successfully.' })
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
  }, [location.pathname, location.search, navigate, toast])

  return (
    <AuthGate>
      <OrgGate>
        <div className="min-h-screen bg-background">
          <Header />
          <main className="pt-12 sm:pt-14">
            <Outlet />
          </main>
        </div>
      </OrgGate>
    </AuthGate>
  )
}
