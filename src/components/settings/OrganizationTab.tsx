import { useState, useEffect } from 'react'
import { useOrganizations } from '@/hooks/useOrganizations'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building, Edit, Lock, AlertTriangle } from 'lucide-react'
import { OrganizationForm } from './OrganizationForm'
import { OrganizationDisplay } from './OrganizationDisplay'
import { useAuth } from '@/contexts/AuthContext'
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
  country: string
  status: 'active' | 'inactive'
  billing_poc_user_id: string | null
  billing_poc_additional_email: string
  billing_poc_phone: string
}

export function OrganizationTab() {
  const { organizations, updateOrganization, isLoading, error } = useOrganizations()
  const { userType, user } = useAuth()
  const [isEditMode, setIsEditMode] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  console.log('OrganizationTab render - organizations:', organizations, 'isLoading:', isLoading, 'error:', error, 'userType:', userType)
  
  // Get the user's organization - prioritize owned organizations for both workspace owners and platform admins
  const getUserOrganization = () => {
    if (!organizations || organizations.length === 0) {
      console.log('OrganizationTab getUserOrganization - no organizations available')
      return null
    }
    
    // For both workspace owners and platform admins, prioritize organizations they own
    if ((userType === 'workspace_owner' || userType === 'platform_admin') && user) {
      console.log('OrganizationTab getUserOrganization - checking for owned organizations for user:', user.id, 'userType:', userType)
      
      const ownedOrganization = organizations.find(org => org.owner_id === user.id)
      if (ownedOrganization) {
        console.log('OrganizationTab getUserOrganization - found owned organization:', ownedOrganization.name, 'id:', ownedOrganization.id)
        return ownedOrganization
      }
      
      console.log('OrganizationTab getUserOrganization - no owned organization found for user:', user.id)
      
      // For workspace owners without owned organizations, this might indicate a data issue
      if (userType === 'workspace_owner') {
        console.warn('OrganizationTab getUserOrganization - workspace owner has no owned organization, this may indicate a data issue')
      }
      
      // For platform admins, fallback to first organization if no owned organization found
      if (userType === 'platform_admin') {
        console.log('OrganizationTab getUserOrganization - platform admin fallback to first available organization')
        return organizations[0]
      }
    }
    
    // For other user types or fallback case, use first organization
    console.log('OrganizationTab getUserOrganization - using first available organization for userType:', userType)
    return organizations[0]
  }
  
  const userOrganization = getUserOrganization()
  console.log('OrganizationTab - selected userOrganization:', userOrganization?.name, 'id:', userOrganization?.id, 'owner_id:', userOrganization?.owner_id)
  
  const [orgFormData, setOrgFormData] = useState<OrganizationFormData>({
    name: '',
    country: '',
    status: 'active',
    billing_poc_user_id: null,
    billing_poc_additional_email: '',
    billing_poc_phone: ''
  })

  useEffect(() => {
    if (userOrganization) {
      console.log('OrganizationTab - updating form data with organization:', userOrganization.name)
      setOrgFormData({
        name: userOrganization.name || '',
        country: userOrganization.country || '',
        status: userOrganization.status || 'active',
        billing_poc_user_id: userOrganization.billing_poc_user_id || null,
        billing_poc_additional_email: userOrganization.billing_poc_additional_email || '',
        billing_poc_phone: userOrganization.billing_poc_phone || ''
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
            country: userOrganization.country || '',
            status: userOrganization.status || 'active',
            billing_poc_user_id: userOrganization.billing_poc_user_id || null,
            billing_poc_additional_email: userOrganization.billing_poc_additional_email || '',
            billing_poc_phone: userOrganization.billing_poc_phone || ''
          })
        }
        setHasUnsavedChanges(false)
      }
    }
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
    setHasUnsavedChanges(false)
    // Reset form data
    if (userOrganization) {
      setOrgFormData({
        name: userOrganization.name || '',
        country: userOrganization.country || '',
        status: userOrganization.status || 'active',
        billing_poc_user_id: userOrganization.billing_poc_user_id || null,
        billing_poc_additional_email: userOrganization.billing_poc_additional_email || '',
        billing_poc_phone: userOrganization.billing_poc_phone || ''
      })
    }
  }

  const handleOrgSave = async () => {
    if (!userOrganization?.id) {
      console.error('OrganizationTab handleOrgSave - Cannot save: no organization ID')
      return
    }

    // Enhanced validation for both workspace owners and platform admins
    if ((userType === 'workspace_owner' || userType === 'platform_admin') && user && userOrganization.owner_id !== user.id) {
      console.error('OrganizationTab handleOrgSave - User trying to edit organization they do not own:', {
        userType,
        userId: user.id,
        organizationOwnerId: userOrganization.owner_id,
        organizationName: userOrganization.name
      })
      return
    }

    try {
      console.log('OrganizationTab handleOrgSave - saving organization:', userOrganization.id, 'data:', orgFormData)
      await updateOrganization(userOrganization.id, orgFormData)
      setIsEditMode(false)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('OrganizationTab handleOrgSave - save error:', error)
      // Error handling is done in the hook
    }
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

  if (isLoading) {
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

  // Enhanced ownership validation for both workspace owners and platform admins
  if ((userType === 'workspace_owner' || userType === 'platform_admin') && user && userOrganization.owner_id !== user.id) {
    console.log('OrganizationTab - user viewing non-owned organization:', {
      userType,
      userId: user.id,
      organizationOwnerId: userOrganization.owner_id,
      organizationName: userOrganization.name
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
                You can only view and edit organizations that you own. Please contact support if you need to be assigned as the owner of an organization.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Current organization: {userOrganization.name} (Owner: {userOrganization.owner_id})
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render the main content
  console.log('OrganizationTab - rendering content with organization:', userOrganization.name, 'editMode:', isEditMode)
  return (
    <div className="space-y-6">
      {/* Header with Edit Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building className="h-4 w-4" />
                Organization Settings
                {!isEditMode && <Lock className="h-3 w-3 text-muted-foreground" />}
              </CardTitle>
              <CardDescription className="text-xs">
                {isEditMode 
                  ? 'Make changes to your organization details and preferences'
                  : 'View your organization details and preferences'
                }
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              {!isEditMode ? (
                <Button 
                  onClick={handleEditModeToggle}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Edit className="h-3 w-3" />
                  Edit Organization
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleOrgSave}
                    disabled={isLoading}
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    Save Changes
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {isEditMode ? (
            <OrganizationForm
              organization={userOrganization}
              formData={orgFormData}
              onFormDataChange={handleFormDataChange}
              onSave={handleOrgSave}
              isLoading={isLoading}
            />
          ) : (
            <OrganizationDisplay organization={userOrganization} />
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Unsaved Changes
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
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
