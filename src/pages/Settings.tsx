
import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { useAuth } from '@/contexts/AuthContext'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

const VALID_TABS = ['profile', 'organization', 'billing', 'members'] as const
type ValidTab = typeof VALID_TABS[number]

export default function Settings() {
  const { user, logout } = useAuth()
  const { organizations, isLoading } = useOrganizations()
  const { profile, isLoading: profileLoading } = useUserProfile()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  // Get tab from URL or default to 'profile'
  const urlTab = searchParams.get('tab')
  const currentTab = VALID_TABS.includes(urlTab as ValidTab) ? (urlTab as ValidTab) : 'profile'
  
  // Get the first organization for demo purposes - in a real app this would be based on user's organization
  const userOrganization = organizations?.[0]

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

  return (
    <AuthGate>
      <Section>
        <AppContainer>
          {/* Header with Navigation */}
          <div className="mb-layout-lg">
            <div className="flex items-center gap-3 mb-4">
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
                <h1 className="text-3xl font-bold tracking-tight text-text-primary">Settings</h1>
                <p className="text-text-secondary mt-sm">
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

          <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-layout-md">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">My Profile</span>
              </TabsTrigger>
              
              <PermissionGate permission="canManageOrganization">
                <TabsTrigger value="organization" className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  <span className="hidden sm:inline">Organization</span>
                </TabsTrigger>
              </PermissionGate>
              
              <PermissionGate permission="canViewBilling">
                <TabsTrigger value="billing" className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  <span className="hidden sm:inline">Billing</span>
                </TabsTrigger>
              </PermissionGate>
              
              <PermissionGate permission="canViewMembers">
                <TabsTrigger value="members" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Members</span>
                </TabsTrigger>
              </PermissionGate>
            </TabsList>

            <TabsContent value="profile" className="space-y-layout-md">
              <ProfileTab />
            </TabsContent>

            <PermissionGate permission="canManageOrganization">
              <TabsContent value="organization" className="space-y-layout-md">
                <OrganizationTab />
              </TabsContent>
            </PermissionGate>

            <PermissionGate permission="canViewBilling">
              <TabsContent value="billing" className="space-y-layout-md">
                <BillingTab />
              </TabsContent>
            </PermissionGate>

            <PermissionGate permission="canViewMembers">
              <TabsContent value="members" className="space-y-layout-md">
                <MembersTab />
              </TabsContent>
            </PermissionGate>
          </Tabs>
        </AppContainer>
      </Section>
    </AuthGate>
  )
}
