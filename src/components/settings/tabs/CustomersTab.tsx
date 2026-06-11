import { useState } from 'react'
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
import { OrganizationsTable } from '@/components/organizations/OrganizationsTable'
import { OrganizationFormSheet } from '@/components/organizations/OrganizationFormSheet'
import { useOrganizations, Organization } from '@/hooks/useOrganizations'

/**
 * Settings · CRM · Customers
 * Lists the client organizations the workspace hires for (not SaaS tenants).
 * Reuses the existing OrganizationsTable + form sheet from /organizations.
 */
export function CustomersTab() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selected, setSelected] = useState<Organization | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const {
    organizations,
    isLoading,
    createOrganization,
    updateOrganization,
    deleteOrganization,
  } = useOrganizations()

  const handleSubmit = async (data: any) => {
    if (selected) await updateOrganization(selected.id, data)
    else await createOrganization(data)
  }

  return (
    <div className="space-y-4">
      <OrganizationsTable
        organizations={organizations}
        isLoading={isLoading}
        onEdit={(o) => {
          setSelected(o)
          setIsFormOpen(true)
        }}
        onDelete={(id) => setDeleteId(id)}
        onCreateNew={() => {
          setSelected(null)
          setIsFormOpen(true)
        }}
      />

      <OrganizationFormSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmit}
        organization={selected}
        isLoading={isLoading}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="mx-4 max-w-md sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate customer</AlertDialogTitle>
            <AlertDialogDescription>
              This sets the customer to inactive. It is not permanently deleted and can be reactivated later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-3">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-auto"
              onClick={async () => {
                if (deleteId) {
                  await deleteOrganization(deleteId)
                  setDeleteId(null)
                }
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
