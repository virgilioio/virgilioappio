import { useState } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { OrganizationsTable } from '@/components/organizations/OrganizationsTable'
import { OrganizationFormSheet } from '@/components/organizations/OrganizationFormSheet'
import { useOrganizations, Organization } from '@/hooks/useOrganizations'
import { PageHeader } from '@/components/layout/PageHeader'

export function OrganizationsTab() {
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
    try {
      if (selectedOrganization) {
        await updateOrganization(selectedOrganization.id, data)
      } else {
        await createOrganization(data)
      }
      // Close form after successful submission
      setIsFormOpen(false)
      setSelectedOrganization(null)
    } catch (error) {
      // Error handling is already done in the hook with toast notifications
      console.error('Form submission error:', error)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Organizations" 
        subtitle="Manage your organizations and departments"
      />

      <div data-onboarding-target="organization">
        <OrganizationsTable
          organizations={organizations}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCreateNew={handleCreateNew}
        />
      </div>

      <OrganizationFormSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        organization={selectedOrganization}
        isLoading={isLoading}
      />

      <AlertDialog open={!!deleteOrgId} onOpenChange={() => setDeleteOrgId(null)}>
        <AlertDialogContent className="mx-4 max-w-md sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this organization? This will set its status to inactive but won't permanently delete it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-3">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="w-full sm:w-auto">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}