
import { useState } from 'react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { OrganizationsTable } from '@/components/organizations/OrganizationsTable'
import { OrganizationForm } from '@/components/organizations/OrganizationForm'
import { useOrganizations, Organization } from '@/hooks/useOrganizations'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'

export default function Organizations() {
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
    if (selectedOrganization) {
      await updateOrganization(selectedOrganization.id, data)
    } else {
      await createOrganization(data)
    }
  }

  return (
    <AuthGate>
      <PermissionGate permission="canViewOrganizations">
        <div className="min-h-screen bg-background">
          <Section variant="default" banded container className="animate-fade-in">
            <PageHeader
              title="Organizations"
              subtitle="Manage organizations and their settings"
            />
          </Section>

          <Section container className="animate-fade-in">
            <OrganizationsTable
              organizations={organizations}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCreateNew={handleCreateNew}
            />

            <OrganizationForm
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
          </Section>
        </div>
      </PermissionGate>
    </AuthGate>
  )
}
