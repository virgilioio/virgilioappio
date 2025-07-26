
import { useState } from 'react'
import { Outlet, Link, useLocation, Routes, Route, useNavigate } from 'react-router-dom'
import { 
  Search,
  Network,
  Calendar,
  LayoutDashboard,
  Building2,
  ArrowLeft,
  DollarSign
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PermissionGate } from '@/components/auth/PermissionGate'
import Workers from './Workers'
import { useWorkers } from '@/hooks/useWorkers'
import Departments from './Departments'
import WorkerProfile from './WorkerProfile'

const sidebarItems = [
  {
    href: '/people-hub',
    icon: LayoutDashboard,
    label: 'Dashboard',
    description: 'Overview and quick actions'
  },
  {
    href: '/people-hub/people',
    icon: Search,
    label: 'People',
    description: 'Browse and manage people'
  },
  {
    href: '/people-hub/payroll',
    icon: DollarSign,
    label: 'Payroll',
    description: 'Manage payroll and compensation'
  },
  {
    href: '/people-hub/org-chart',
    icon: Network,
    label: 'Org Chart',
    description: 'View organizational structure'
  },
  {
    href: '/people-hub/time-off',
    icon: Calendar,
    label: 'Time Off',
    description: 'Manage time off requests'
  },
  {
    href: '/people-hub/departments',
    icon: Building2,
    label: 'Departments',
    description: 'Manage organizational departments'
  }
]

export default function PeopleHub() {
  return (
    <PermissionGate 
      permission="isPlatformAdmin" 
      fallback={
        <PermissionGate 
          permission="isWorkspaceOwner"
          fallback={
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground">You don't have permission to access the People Hub.</p>
              </div>
            </div>
          }
        >
          <PeopleHubContent />
        </PermissionGate>
      }
    >
      <PeopleHubContent />
    </PermissionGate>
  )
}

function PeopleHubContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedItem, setSelectedItem] = useState(location.pathname)
  const { workers } = useWorkers()

  const isExactMatch = (href: string) => {
    if (href === '/people-hub' && location.pathname === '/people-hub') return true
    if (href === '/people-hub/people' && location.pathname.startsWith('/people-hub/people')) return true
    return location.pathname === href
  }

  // Check if we're on a worker profile page
  const workerProfileMatch = location.pathname.match(/^\/people-hub\/people\/(.+)$/)
  const isWorkerProfile = !!workerProfileMatch
  const workerId = workerProfileMatch?.[1]
  const currentWorker = workerId ? workers?.find(w => w.id === workerId) : null


  return (
    <div className="flex h-full">
      {/* Floating Vertical Sidebar */}
      <div className="w-40 flex-shrink-0 p-4 flex justify-center">
        <div className="bg-card border border-border rounded-full shadow-lg h-fit py-8 px-4 flex flex-col items-center">
          <nav className="space-y-3">
            {sidebarItems.map((item) => {
              const Icon = item.icon
              const isActive = isExactMatch(item.href)
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSelectedItem(item.href)}
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  title={item.label}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
          <div className="mb-6 sm:mb-8 lg:mb-12">
            {isWorkerProfile ? (
              // Worker Profile Header - Just Back Button
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/people-hub/people')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to People
              </Button>
            ) : (
              // Regular Section Headers
              (() => {
                const currentItem = sidebarItems.find(item => isExactMatch(item.href))
                const Icon = currentItem?.icon || Search
                let title = currentItem?.label || 'People Hub'
                if (title === 'Dashboard') title = 'People Dashboard'
                
                return (
                  <>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                      <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                      {title}
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm sm:text-md">
                      {currentItem?.description || 'Comprehensive talent management and sourcing platform'}
                    </p>
                  </>
                )
              })()
            )}
          </div>
        
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<PeopleHubOverview />} />
              <Route path="/people" element={<Workers />} />
              <Route path="/people/:workerId" element={<WorkerProfile />} />
              <Route path="/departments" element={<Departments />} />
              <Route path="/*" element={<Outlet />} />
            </Routes>
          </div>
        </div>
      </div>
    </div>
  )
}

function PeopleHubOverview() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Total People</h3>
          </div>
          <p className="text-2xl font-bold text-foreground">1,247</p>
          <p className="text-sm text-muted-foreground">+12% from last month</p>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Organization Levels</h3>
          </div>
          <p className="text-2xl font-bold text-foreground">8</p>
          <p className="text-sm text-muted-foreground">Across departments</p>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Pending Time Off</h3>
          </div>
          <p className="text-2xl font-bold text-foreground">12</p>
          <p className="text-sm text-muted-foreground">Requests to review</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/people-hub/people">
            <Button variant="outline" className="h-auto p-4 w-full flex flex-col items-center gap-2">
              <Search className="h-6 w-6" />
              <span>Browse People</span>
            </Button>
          </Link>
          <Link to="/people-hub/org-chart">
            <Button variant="outline" className="h-auto p-4 w-full flex flex-col items-center gap-2">
              <Network className="h-6 w-6" />
              <span>View Org Chart</span>
            </Button>
          </Link>
          <Link to="/people-hub/time-off">
            <Button variant="outline" className="h-auto p-4 w-full flex flex-col items-center gap-2">
              <Calendar className="h-6 w-6" />
              <span>Manage Time Off</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
