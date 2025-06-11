
import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AuthGate } from '@/components/auth/AuthGate'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ArrowLeft, LogOut } from 'lucide-react'
import { Section } from '@/components/layout/Section'
import { AppContainer } from '@/components/layout/AppContainer'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { ProfileTab } from '@/components/settings/ProfileTab'
import { OrganizationTab } from '@/components/settings/OrganizationTab'
import { BillingTab } from '@/components/settings/BillingTab'
import { MembersTab } from '@/components/settings/MembersTab'
import { SettingsSidebar } from '@/components/settings/SettingsSidebar'
import { SettingsMobileHeader } from '@/components/settings/SettingsMobileHeader'

const VALID_TABS = ['profile', 'organization', 'billing', 'members'] as const
type ValidTab = typeof VALID_TABS[number]

export default function Settings() {
  const { logout } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  // Get tab from URL or default to 'profile'
  const urlTab = searchParams.get('tab')
  const currentTab = VALID_TABS.includes(urlTab as ValidTab) ? (urlTab as ValidTab) : 'profile'

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab })
    setMobileMenuOpen(false) // Close mobile menu when switching tabs
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

  const renderTabContent = () => {
    switch (currentTab) {
      case 'profile':
        return <ProfileTab />
      case 'organization':
        return <OrganizationTab />
      case 'billing':
        return <BillingTab />
      case 'members':
        return <MembersTab />
      default:
        return <ProfileTab />
    }
  }

  return (
    <AuthGate>
      <Section className="min-h-screen">
        <AppContainer className="max-w-none">
          {/* Mobile Header */}
          <SettingsMobileHeader 
            onMenuToggle={() => setMobileMenuOpen(true)}
            onBackToDashboard={handleBackToDashboard}
          />

          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between mb-6 lg:mb-8 pt-6 lg:pt-8">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleBackToDashboard}
                className="flex items-center gap-2 min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>
            
            <Button 
              variant="destructive" 
              onClick={handleLogout}
              className="flex items-center gap-2 min-h-[44px]"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>

          {/* Page Title - Desktop Only */}
          <div className="hidden md:block mb-6 lg:mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-text-primary">Settings</h1>
            <p className="text-md lg:text-lg text-text-secondary leading-relaxed mt-2">
              Manage your account settings and preferences
            </p>
          </div>

          {/* Main Layout */}
          <div className="flex flex-col lg:flex-row min-h-[calc(100vh-200px)] gap-6">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-6 h-[calc(100vh-200px)] overflow-y-auto">
                <div className="bg-surface-primary border border-border rounded-brand p-2">
                  <SettingsSidebar 
                    currentTab={currentTab}
                    onTabChange={handleTabChange}
                  />
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              <div className="w-full px-4 lg:px-0">
                {renderTabContent()}
              </div>
            </div>
          </div>

          {/* Mobile Sidebar Sheet */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent side="left" className="w-72 p-0">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
                <p className="text-sm text-text-secondary mt-1">
                  Manage your account
                </p>
              </div>
              <div className="p-2">
                <SettingsSidebar 
                  currentTab={currentTab}
                  onTabChange={handleTabChange}
                />
              </div>
            </SheetContent>
          </Sheet>
        </AppContainer>
      </Section>
    </AuthGate>
  )
}
