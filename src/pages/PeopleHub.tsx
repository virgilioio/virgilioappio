import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  Users, 
  UserPlus, 
  Building2, 
  Search,
  TrendingUp,
  Activity
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const sidebarItems = [
  {
    href: '/people-hub',
    icon: Activity,
    label: 'Overview',
    description: 'General overview and metrics'
  },
  {
    href: '/people-hub/candidates',
    icon: Users,
    label: 'All Candidates',
    description: 'Browse all candidate profiles'
  },
  {
    href: '/people-hub/talent-pool',
    icon: TrendingUp,
    label: 'Talent Pool',
    description: 'Curated talent recommendations'
  },
  {
    href: '/people-hub/sourcing',
    icon: Search,
    label: 'Sourcing',
    description: 'Find and recruit new talent'
  },
  {
    href: '/people-hub/organizations',
    icon: Building2,
    label: 'Partner Organizations',
    description: 'Manage partner relationships'
  },
  {
    href: '/people-hub/add-candidate',
    icon: UserPlus,
    label: 'Add Candidate',
    description: 'Create new candidate profile'
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
        <PageHeader 
          title="People Hub" 
          subtitle="Comprehensive talent management and sourcing platform" 
        />
        
        <div className="flex-1 p-6">
          {location.pathname === '/people-hub' ? (
            <PeopleHubOverview />
          ) : (
            <Outlet />
          )}
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
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Total Candidates</h3>
          </div>
          <p className="text-2xl font-bold text-foreground">1,247</p>
          <p className="text-sm text-muted-foreground">+12% from last month</p>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Active Placements</h3>
          </div>
          <p className="text-2xl font-bold text-foreground">89</p>
          <p className="text-sm text-muted-foreground">+5% from last month</p>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Partner Organizations</h3>
          </div>
          <p className="text-2xl font-bold text-foreground">34</p>
          <p className="text-sm text-muted-foreground">+2 new this month</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/people-hub/add-candidate">
            <Button variant="outline" className="h-auto p-4 w-full flex flex-col items-center gap-2">
              <UserPlus className="h-6 w-6" />
              <span>Add New Candidate</span>
            </Button>
          </Link>
          <Link to="/people-hub/sourcing">
            <Button variant="outline" className="h-auto p-4 w-full flex flex-col items-center gap-2">
              <Search className="h-6 w-6" />
              <span>Source Talent</span>
            </Button>
          </Link>
          <Link to="/people-hub/talent-pool">
            <Button variant="outline" className="h-auto p-4 w-full flex flex-col items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              <span>View Talent Pool</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}