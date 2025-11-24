import { useState, useEffect } from 'react'
import { useOrganizations } from '@/hooks/useOrganizations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Building, Edit, Lock, AlertTriangle, Save, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { OrganizationDisplay } from './OrganizationDisplay'
import { OrganizationSwitcher } from './OrganizationSwitcher'
import { VerifiedDomainsManager } from './VerifiedDomainsManager'
// Currency settings removed
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useIsVirgilioAdmin } from '@/hooks/useIsVirgilioAdmin'
import { supabase } from '@/lib/supabaseClient'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface OrganizationFormData {
  name: string
  status: 'active' | 'inactive'
  billing_poc_user_id: string | null
  billing_poc_additional_email: string
  billing_poc_phone: string
  parent_organization_id: string | null
}

export function OrganizationTab() {
  const { organizations, updateOrganization, isLoading, error } = useOrganizations()
  const { userType, user, organizationId } = useAuth()
  const { toast } = useToast()
  const isVirgilioAdmin = useIsVirgilioAdmin()
  const [isEditMode, setIsEditMode] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Separate data fetch for platform admins to get the Virgilio organization
  const [platformAdminOrg, setPlatformAdminOrg] = useState<any>(null)
  const [platformAdminOrgLoading, setPlatformAdminOrgLoading] = useState(false)
  
  useEffect(() => {
    async function fetchPlatformAdminOrg() {
      if (userType !== 'platform_admin') return
      
      setPlatformAdminOrgLoading(true)
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('name', 'Virgilio')
          .eq('organization_type', 'platform')
          .eq('tenant_type', 'saas')
          .eq('org_kind', 'root')
          .single()
        
        if (error) {
          console.error('Error fetching platform admin organization:', error)
        } else {
          console.log('OrganizationTab - fetched Virgilio platform org:', data)
          setPlatformAdminOrg(data)
        }
      } catch (err) {
        console.error('Error in fetchPlatformAdminOrg:', err)
      } finally {
        setPlatformAdminOrgLoading(false)
      }
    }
    
    fetchPlatformAdminOrg()
  }, [userType])
  
  console.log('OrganizationTab render - organizations:', organizations, 'isLoading:', isLoading, 'error:', error, 'userType:', userType, 'platformAdminOrg:', platformAdminOrg)
  
  const getUserOrganization = () => {
    // For platform admins, use the separately-fetched Virgilio organization
    if (userType === 'platform_admin') {
      console.log('OrganizationTab getUserOrganization - platform admin using Virgilio org:', platformAdminOrg?.name)
      return platformAdminOrg
    }
    
    // For other user types, use the useOrganizations hook data
    if (!organizations || organizations.length === 0) {
      console.log('OrganizationTab getUserOrganization - no organizations available')
      return null
    }
    
    // Filter to only root organizations (the primary workspace entity for each tenant)
    const rootOrganizations = organizations.filter(org => org.org_kind === 'root')
    
    if (rootOrganizations.length === 0) {
      console.warn('OrganizationTab getUserOrganization - no root organizations found')
      return null
    }
    
    // For workspace owners, prioritize organizations they own
    if (userType === 'workspace_owner' && user) {
      console.log('OrganizationTab getUserOrganization - checking for owned root organizations for user:', user.id)
      
      const ownedRoot = rootOrganizations.find(org => org.owner_id === user.id)
      if (ownedRoot) {
        console.log('OrganizationTab getUserOrganization - found owned root organization:', ownedRoot.name, 'id:', ownedRoot.id)
        return ownedRoot
      }
      
      console.warn('OrganizationTab getUserOrganization - workspace owner has no owned root organization, this may indicate a data issue')
    }
    
    // Fallback to first root organization
    console.log('OrganizationTab getUserOrganization - using first available root organization for userType:', userType)
    return rootOrganizations[0]
  }
  
  const userOrganization = getUserOrganization()
  console.log('OrganizationTab - selected userOrganization:', userOrganization?.name, 'id:', userOrganization?.id, 'owner_id:', userOrganization?.owner_id)
  
const [orgFormData, setOrgFormData] = useState<OrganizationFormData>({
  name: '',
  status: 'active',
  billing_poc_user_id: null,
  billing_poc_additional_email: '',
  billing_poc_phone: '',
  parent_organization_id: null
})

  useEffect(() => {
    if (userOrganization) {
      console.log('OrganizationTab - updating form data with organization:', userOrganization.name)
      setOrgFormData({
        name: userOrganization.name || '',
        status: userOrganization.status || 'active',
        billing_poc_user_id: userOrganization.billing_poc_user_id || null,
        billing_poc_additional_email: userOrganization.billing_poc_additional_email || '',
        billing_poc_phone: userOrganization.billing_poc_phone || '',
        parent_organization_id: userOrganization.parent_organization_id || null
      })
    }
  }, [userOrganization])

  const handleFormDataChange = (data: OrganizationFormData) => {
    setOrgFormData(data)
    setHasUnsavedChanges(true)
  }

  const handleEditModeToggle = () => {
    if (isEditMode && hasUnsavedChanges) {
      setShowConfirmDialog(true)
    } else {
      setIsEditMode(!isEditMode)
      if (!isEditMode) {
        // Reset form data when entering edit mode
        if (userOrganization) {
          setOrgFormData({
            name: userOrganization.name || '',
            status: userOrganization.status || 'active',
            billing_poc_user_id: userOrganization.billing_poc_user_id || null,
            billing_poc_additional_email: userOrganization.billing_poc_additional_email || '',
            billing_poc_phone: userOrganization.billing_poc_phone || '',
            parent_organization_id: userOrganization.parent_organization_id || null
          })
        }
        setHasUnsavedChanges(false)
      }
    }
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
    setHasUnsavedChanges(false)
    setIsSaving(false)
    // Reset form data
    if (userOrganization) {
      setOrgFormData({
        name: userOrganization.name || '',
        status: userOrganization.status || 'active',
        billing_poc_user_id: userOrganization.billing_poc_user_id || null,
        billing_poc_additional_email: userOrganization.billing_poc_additional_email || '',
        billing_poc_phone: userOrganization.billing_poc_phone || '',
        parent_organization_id: userOrganization.parent_organization_id || null
      })
    }
  }

  const handleSave = async () => {
    if (!userOrganization?.id) {
      toast({
        title: "Error",
        description: "Cannot save: organization not found",
        variant: "destructive"
      })
      return
    }

    setIsSaving(true)

    try {
      await updateOrganization(userOrganization.id, orgFormData)
      
      toast({
        title: "Success",
        description: "Organization settings saved successfully",
      })

      setIsEditMode(false)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Error saving organization data:', error)
      toast({
        title: "Save Failed", 
        description: "There was an error saving your changes. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Create a wrapper function that matches the expected signature for OrganizationForm
  const handleUpdateOrganization = async (id: string, data: OrganizationFormData): Promise<void> => {
    await updateOrganization(id, data)
  }

  if (error) {
    console.log('OrganizationTab - rendering error state:', error)
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building className="h-4 w-4" />
              Organization Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Manage your organization details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-destructive text-sm">Error loading organization data: {error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show loading state when either useOrganizations is loading OR platform admin org is loading
  if (isLoading || (userType === 'platform_admin' && platformAdminOrgLoading)) {
    console.log('OrganizationTab - rendering loading state')
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building className="h-4 w-4" />
              Organization Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Manage your organization details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm">Loading organization data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!userOrganization) {
    console.log('OrganizationTab - rendering no organization state')
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building className="h-4 w-4" />
              Organization Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Manage your organization details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm">
                {userType === 'workspace_owner' 
                  ? 'No organization found. Please contact support if you believe this is an error.'
                  : userType === 'platform_admin'
                  ? 'No organization data available. Please contact support if you believe this is an error.'
                  : 'No organization data available'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Enhanced access validation - workspace owners and platform admins can edit their organization
  const canEditOrganization = userType === 'platform_admin' || 
    (userType === 'workspace_owner' && userOrganization?.id);
  
  if (!canEditOrganization) {
    console.log('OrganizationTab - user cannot edit organization:', {
      userType,
      userId: user?.id,
      organizationId: userOrganization?.id,
      organizationName: userOrganization?.name
    })
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building className="h-4 w-4" />
              Organization Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Manage your organization details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm">
                You don't have permission to edit organization settings. Please contact your administrator for access.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render the main content with tabs
  console.log('OrganizationTab - rendering content with organization:', userOrganization.name, 'editMode:', isEditMode)
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Company Profile" 
        subtitle="Manage your organization details and preferences"
      >
        {!isEditMode && (
          <Button 
            onClick={handleEditModeToggle}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <Edit className="h-3 w-3" />
            Edit
          </Button>
        )}
      </PageHeader>
      
      {/* Organization Switcher for Platform Admins */}
      <OrganizationSwitcher />
      
      {/* Main Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building className="h-4 w-4 text-virgilio-purple" />
            Company Profile<span className="text-purple-period">.</span>
          </CardTitle>
          <CardDescription className="text-xs">
            {isEditMode 
              ? 'Make changes to your organization details and preferences'
              : 'View your organization details and preferences'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-md">
          <OrganizationDisplay organization={userOrganization} />
          
          {/* Save Buttons - only show in edit mode */}
          {isEditMode && (
            <div className="flex justify-end pt-sm border-t border-border">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1"
                >
                  {isSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verified Domains Management */}
      {userOrganization?.id && (userType === 'workspace_owner' || isVirgilioAdmin) && (
        <VerifiedDomainsManager
          tenantId={userOrganization.tenant_id}
          isWorkspaceOwner={userType === 'workspace_owner'}
          isPlatformAdmin={isVirgilioAdmin}
        />
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg font-poppins font-bold text-virgilio-text tracking-page-title">
              <AlertTriangle className="h-4 w-4 text-virgilio-error" />
              Unsaved Changes<span className="text-purple-period">.</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-virgilio-muted">
              You have unsaved changes to your organization settings. Are you sure you want to exit edit mode? 
              Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>
              Continue Editing
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowConfirmDialog(false)
                handleCancelEdit()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
