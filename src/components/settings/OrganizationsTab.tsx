import { useState } from 'react'
import { Plus, Download } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { OrganizationsTable, useOrganizationCounts } from '@/components/organizations/OrganizationsTable'
import { OrganizationFormSheet } from '@/components/organizations/OrganizationFormSheet'
import { useOrganizations, Organization } from '@/hooks/useOrganizations'
import { useDeals } from '@/hooks/useDeals'
import { usePermissions } from '@/hooks/usePermissions'

export function OrganizationsTab() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null)
  const [deleteOrgId, setDeleteOrgId] = useState<string | null>(null)

  const permissions = usePermissions()
  const {
    organizations,
    isLoading,
    createOrganization,
    updateOrganization,
    deleteOrganization,
  } = useOrganizations()
  const { data: deals = [] } = useDeals()
  const counts = useOrganizationCounts(organizations)

  const handleCreateNew = () => {
    setSelectedOrganization(null)
    setIsFormOpen(true)
  }

  const handleEdit = (organization: Organization) => {
    setSelectedOrganization(organization)
    setIsFormOpen(true)
  }

  const handleDelete = (id: string) => setDeleteOrgId(id)

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
      setIsFormOpen(false)
      setSelectedOrganization(null)
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header — matches Jobs */}
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-poppins font-semibold tracking-[-0.04em] text-text-primary text-[28px] leading-tight sm:text-[32px]">
              Companies<span className="text-virgilio-purple">.</span>
            </h1>
            <Badge tone="neutral" size="sm">{counts.total}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-pastel-green-foreground" />
              {counts.active} active
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary" />
              {counts.inactive} inactive
            </span>
            <span className="text-text-tertiary">·</span>
            <span>{deals.length} open deals</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="md" icon={Download}>Export</Button>
          {permissions.canCreateOrganizations && (
            <Button variant="primary" size="md" icon={Plus} onClick={handleCreateNew}>
              Create company
            </Button>
          )}
        </div>
      </header>

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
        onDelete={async (id) => { await deleteOrganization(id) }}
      />

      <AlertDialog open={!!deleteOrgId} onOpenChange={() => setDeleteOrgId(null)}>
        <AlertDialogContent className="mx-4 max-w-md sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this company? This will set its status to inactive but won't permanently delete it.
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
