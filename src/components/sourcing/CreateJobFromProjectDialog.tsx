import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Building2, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabaseClient'
import { useChildOrganizationsForJobCreation } from '@/hooks/useChildOrganizationsForJobCreation'
import { OrganizationFormSheet } from '@/components/organizations/OrganizationFormSheet'
import { useOrganizations } from '@/hooks/useOrganizations'
import type { JobSpecData } from '@/types/sourcing'

interface CreateJobFromProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  jobSpecData: JobSpecData | null
}

export function CreateJobFromProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  jobSpecData
}: CreateJobFromProjectDialogProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [isOrgFormOpen, setIsOrgFormOpen] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()
  const { data: childOrgs, isLoading: isLoadingOrgs, refetch: refetchOrgs } = useChildOrganizationsForJobCreation()
  const { createOrganization, isLoading: isCreatingOrg } = useOrganizations()

  const orgOptions = (childOrgs || [])
    .map(org => ({
      value: org.id,
      label: org.name
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const handleCreateOrganization = async (data: any) => {
    try {
      const result = await createOrganization(data)
      await refetchOrgs()
      setIsOrgFormOpen(false)
      // Auto-select the newly created department
      if (result && typeof result === 'object' && 'id' in result) {
        setSelectedOrgId(result.id)
      }
    } catch (error) {
      console.error('Failed to create department:', error)
    }
  }

  const handleCreateJob = async () => {
    if (!selectedOrgId) {
      toast({
        title: 'Select Department',
        description: 'Please select a department where the job will be created.',
        variant: 'destructive'
      })
      return
    }

    setIsCreating(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-job-from-sourcing-project', {
        body: {
          sourcing_project_id: projectId,
          organization_id: selectedOrgId
        }
      })

      if (error) {
        throw new Error(error.message)
      }

      toast({
        title: 'Job Created',
        description: `"${data.job_title}" has been created successfully.`
      })

      onOpenChange(false)
      
      // Navigate to the new job
      navigate(`/jobs/${data.job_id}`)
    } catch (error: any) {
      console.error('Error creating job:', error)
      toast({
        title: 'Failed to Create Job',
        description: error.message || 'An error occurred while creating the job.',
        variant: 'destructive'
      })
    } finally {
      setIsCreating(false)
    }
  }

  if (!jobSpecData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Create Job</DialogTitle>
            <DialogDescription>
              This sourcing project does not have job specification data. Only projects created via AI can be converted to jobs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Create Job from Sourcing Project
            </DialogTitle>
            <DialogDescription>
              Create a new job posting using the AI-generated specifications from "{projectName}".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Job Preview */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium text-foreground">
                {jobSpecData.job_title}
              </div>
              {jobSpecData.location && (
                <div className="text-sm text-muted-foreground">
                  📍 {jobSpecData.location}
                </div>
              )}
              {jobSpecData.department && (
                <div className="text-sm text-muted-foreground">
                  🏢 {jobSpecData.department}
                </div>
              )}
              {jobSpecData.salary_range && (
                <div className="text-sm text-muted-foreground">
                  💰 {jobSpecData.salary_range.currency} {jobSpecData.salary_range.min.toLocaleString()} - {jobSpecData.salary_range.max.toLocaleString()}
                </div>
              )}
              {jobSpecData.skills && jobSpecData.skills.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  🛠️ {jobSpecData.skills.slice(0, 3).join(', ')}{jobSpecData.skills.length > 3 && ` +${jobSpecData.skills.length - 3} more`}
                </div>
              )}
            </div>

            {/* Department Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Select Department
              </Label>
              <SearchableSelect
                options={orgOptions}
                value={selectedOrgId}
                onValueChange={setSelectedOrgId}
                placeholder={isLoadingOrgs ? "Loading departments..." : "Select a department..."}
                searchPlaceholder="Search departments..."
                emptyMessage="No departments found."
                disabled={isLoadingOrgs}
                onCreateNew={() => setIsOrgFormOpen(true)}
                createNewLabel="Create Department"
              />
              <p className="text-xs text-muted-foreground">
                The job will be created in this department and start as a draft.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateJob} disabled={isCreating || !selectedOrgId}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Briefcase className="h-4 w-4 mr-2" />
                  Create Job
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrganizationFormSheet
        isOpen={isOrgFormOpen}
        onClose={() => setIsOrgFormOpen(false)}
        onSubmit={handleCreateOrganization}
        isLoading={isCreatingOrg}
      />
    </>
  )
}
