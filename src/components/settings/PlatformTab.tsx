
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { OrganizationsTable } from '@/components/organizations/OrganizationsTable'
import { OrganizationForm } from '@/components/organizations/OrganizationForm'
import { useOrganizations, Organization } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'
import { Shield, Search, Plus, Building2 } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

export function PlatformTab() {
  const permissions = usePermissions()
  const [searchQuery, setSearchQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null)
  const [deleteOrgId, setDeleteOrgId] = useState<string | null>(null)
  
  const {
    organizations,
    isLoading,
    createOrganization,
    updateOrganization,
    deleteOrganization
  } = useOrganizations()

  // Check if user has access to platform features
  if (!permissions.isPlatformAdmin && !permissions.canCreateOrganizations) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
            <p className="text-muted-foreground">
              You don't have permission to access platform settings.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Filter organizations based on search query
  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.country.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateNew = () => {
    setSelectedOrganization(null)
    setIsFormOpen(true)
  }

  const handleEdit = (organization: Organization) => {
    setSelectedOrganization(organization)
    setIsFormOpen(true)
  }

  const handleDelete = (id: string) => {
    setDeleteOrgId(id)
  }

  const handleConfirmDelete = async () => {
    if (deleteOrgId) {
      await deleteOrganization(deleteOrgId)
      setDeleteOrgId(null)
    }
  }

  const handleFormSubmit = async (data: any) => {
    if (selectedOrganization) {
      await updateOrganization(selectedOrganization.id, data)
    } else {
      await createOrganization(data)
    }
    setIsFormOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">Platform Settings</h2>
        <p className="text-muted-foreground">
          Manage organizations and platform-wide settings
        </p>
      </div>

      {/* User Context Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
            Access Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <Badge variant={permissions.isPlatformAdmin ? "default" : "secondary"}>
                {permissions.isPlatformAdmin ? 'Platform Admin' : 'Customer Success'}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Organization Management: <Badge variant={permissions.canManageOrganization ? "default" : "secondary"} className="ml-1">
                {permissions.canManageOrganization ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organizations Manager */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organizations Manager
              </CardTitle>
              <CardDescription>
                Manage all organizations across the platform
              </CardDescription>
            </div>
            <Button onClick={handleCreateNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Organization
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search organizations by name or country..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Organizations Table */}
          <OrganizationsTable
            organizations={filteredOrganizations}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreateNew={handleCreateNew}
          />
        </CardContent>
      </Card>

      {/* Organization Form Modal */}
      <OrganizationForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        organization={selectedOrganization}
        isLoading={isLoading}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteOrgId} onOpenChange={() => setDeleteOrgId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this organization? This will set its status to inactive but won't permanently delete it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
