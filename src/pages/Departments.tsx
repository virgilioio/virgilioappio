import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { DepartmentTable } from '@/components/departments/DepartmentTable'
import { DepartmentForm } from '@/components/departments/DepartmentForm'
import { useDepartments } from '@/hooks/useDepartments'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'

export default function Departments() {
  const { profile: userProfile } = useUserProfile()
  const permissions = usePermissions()
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  // Platform admins see all departments, others see only their organization's
  const organizationId = permissions.isPlatformAdmin ? undefined : userProfile?.organization_id
  
  const { 
    data: departments = [], 
    isLoading, 
    error 
  } = useDepartments(organizationId)

  const canManageDepartments = permissions.isPlatformAdmin || permissions.isWorkspaceOwner

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Departments</h3>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Section variant="default" banded container className="animate-fade-in">
        <PageHeader
          title="Departments"
          subtitle="Manage organizational departments and their structure"
        >
          {canManageDepartments && (
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Department
            </Button>
          )}
        </PageHeader>
      </Section>

      <Section container className="animate-fade-in">
        <DepartmentTable 
          departments={departments} 
          isLoading={isLoading}
        />

        <DepartmentForm
          open={showCreateForm}
          onOpenChange={setShowCreateForm}
        />
      </Section>
    </>
  )
}