
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, Building, Receipt, Users, ArrowLeft, LogOut } from 'lucide-react'
import { Section } from '@/components/layout/Section'
import { AppContainer } from '@/components/layout/AppContainer'
import { toast } from '@/hooks/use-toast'
import { ProfileTab } from '@/components/settings/ProfileTab'
import { OrganizationTab } from '@/components/settings/OrganizationTab'
import { BillingTab } from '@/components/settings/BillingTab'
import { MembersTab } from '@/components/settings/MembersTab'
import { usePermissions } from '@/hooks/usePermissions'

const VALID_TABS = ['profile', 'organization', 'billing', 'members'] as const
type ValidTab = typeof VALID_TABS[number]

export default function Settings() {
  const { user, logout } = useAuth()
  const permissions = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // Get tab from URL or default to 'profile'
  const urlTab = searchParams.get('tab')
  const currentTab = VALID_TABS.includes(urlTab as ValidTab) ? (urlTab as ValidTab) : 'profile'

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab })
  }

  const handleLogout = async () => {
    try {
      await logout()
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out.'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to log out. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const handleBackToDashboard = () => {
    navigate('/')
  }

  // Filter available tabs based on permissions
  const availableTabs = [
    { id: 'profile', label: 'My Profile', icon: User, component: ProfileTab, show: true },
    { 
      id: 'organization', 
      label: 'Organization', 
      icon: Building, 
      component: OrganizationTab, 
      show: permissions.canManageOrganization 
    },
    { 
      id: 'billing', 
      label: 'Billing', 
      icon: Receipt, 
      component: BillingTab, 
      show: permissions.canViewBilling 
    },
    { 
      id: 'members', 
      label: 'Members', 
      icon: Users, 
      component: MembersTab, 
      show: permissions.canViewMembers 
    },
  ].filter(tab => tab.show)

  return (
    <AuthGate>
      <Section>
        <AppContainer>
          {/* Header with Navigation */}
          <div className="mb-layout-lg">
            <div className="flex items-center gap-3 mb-layout-sm">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleBackToDashboard}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="heading-1 text-text-primary">Settings</h1>
                <p className="text-md text-text-secondary leading-relaxed">
                  Manage your account settings and preferences
                </p>
              </div>
              
              <Button 
                variant="destructive" 
                onClick={handleLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>

          {/* Sticky Tab Navigation */}
          <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 pb-layout-sm mb-layout-md">
            <Tabs value={currentTab} onValueChange={handleTabChange}>
              <TabsList className={`grid w-full max-w-2xl grid-cols-${availableTabs.length}`}>
                {availableTabs.map((tab) => (
                  <TabsTrigger 
                    key={tab.id} 
                    value={tab.id} 
                    className="flex items-center gap-2 transition-all text-sm font-medium"
                  >
                    <tab.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Tab Content */}
              <div className="mt-layout-md">
                <TabsContent value="profile" className="m-0">
                  <ProfileTab />
                </TabsContent>

                <TabsContent value="organization" className="m-0">
                  <OrganizationTab />
                </TabsContent>

                <TabsContent value="billing" className="m-0">
                  <BillingTab />
                </TabsContent>

                <TabsContent value="members" className="m-0">
                  <MembersTab />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </AppContainer>
      </Section>
    </AuthGate>
  )
}
