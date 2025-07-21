
import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  Search,
  Network,
  Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Workers from './Workers'

const sidebarItems = [
  {
    href: '/people-hub/people',
    icon: Search,
    label: 'People',
    description: 'Browse and manage people'
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
  }
]

export default function PeopleHub() {
  const location = useLocation()
  const [selectedItem, setSelectedItem] = useState(location.pathname)

  const isExactMatch = (href: string) => {
    return location.pathname === href || (href === '/people-hub' && location.pathname === '/people-hub')
  }

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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Search className="h-6 w-6 sm:h-7 sm:w-7" />
              People Hub
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-md">
              Comprehensive talent management and sourcing platform
            </p>
          </div>
        
          <div className="flex-1">
            {location.pathname === '/people-hub' ? (
              <PeopleHubOverview />
            ) : location.pathname === '/people-hub/people' ? (
              <Workers />
            ) : (
              <Outlet />
            )}
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
