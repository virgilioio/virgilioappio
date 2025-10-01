import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Briefcase, Users, Building2 } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { JobWizard } from '@/components/jobs/JobWizard'
import { CandidateFormSheet } from '@/components/candidates/CandidateFormSheet'
import { OrganizationFormSheet } from '@/components/organizations/OrganizationFormSheet'
import { useOrganizations, type CreateOrganizationData } from '@/hooks/useOrganizations'
import { useIndependentCandidates, CreateIndependentCandidateData } from '@/hooks/useIndependentCandidates'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'

export function GlobalCreateButton() {
  const { canCreateJobs, canCreateCandidates, isPlatformAdmin } = usePermissions()
  const [jobWizardOpen, setJobWizardOpen] = useState(false)
  const [candidateSheetOpen, setCandidateSheetOpen] = useState(false)
  const [organizationFormOpen, setOrganizationFormOpen] = useState(false)
  const { createOrganization, isLoading: isCreatingOrg } = useOrganizations()
  const { addCandidate, isLoading: isCreatingCandidate } = useIndependentCandidates()

  // Handle candidate submission with job assignment logic
  const handleCandidateSubmit = async (candidateData: CreateIndependentCandidateData & { assignedJobId?: string; assignedStageId?: string }) => {
    try {
      // Create the candidate first
      const newCandidate = await addCandidate(candidateData)
      
      // If job is assigned, create the job-candidate association
      if (candidateData.assignedJobId && newCandidate) {
        const { error: associationError } = await supabase
          .from('job_candidate_associations')
          .insert({
            job_id: candidateData.assignedJobId,
            candidate_id: newCandidate.id,
            current_stage_id: candidateData.assignedStageId || null,
            added_by: (await supabase.auth.getUser()).data.user?.id
          })

        if (associationError) {
          console.error('Error creating job association:', associationError)
          toast({
            title: 'Warning',
            description: 'Candidate created but could not be assigned to job. You can assign them manually.',
            variant: 'destructive'
          })
        } else {
          toast({
            title: 'Success',
            description: 'Candidate created and assigned to job successfully!'
          })
        }
      } else {
        toast({
          title: 'Success',
          description: 'Candidate created successfully!'
        })
      }
      
      setCandidateSheetOpen(false)
    } catch (error) {
      console.error('Error creating candidate:', error)
      // Error handling is done in the hook
    }
  }

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'j' && canCreateJobs) {
          e.preventDefault()
          setJobWizardOpen(true)
        } else if (e.key === 'k' && canCreateCandidates) {
          e.preventDefault()
          setCandidateSheetOpen(true)
        } else if (e.key === 'o' && isPlatformAdmin) {
          e.preventDefault()
          setOrganizationFormOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canCreateJobs, canCreateCandidates, isPlatformAdmin])

  // Don't render if user has no create permissions
  if (!canCreateJobs && !canCreateCandidates && !isPlatformAdmin) {
    return null
  }

  const createOptions = []

  if (canCreateJobs) {
    createOptions.push({
      label: 'New Job',
      description: 'Create a new job posting',
      icon: Briefcase,
      onClick: () => setJobWizardOpen(true),
      shortcut: '⌘J'
    })
  }

  if (canCreateCandidates) {
    createOptions.push({
      label: 'New Candidate',
      description: 'Add a new candidate',
      icon: Users,
      onClick: () => setCandidateSheetOpen(true),
      shortcut: '⌘K'
    })
  }

  if (isPlatformAdmin) {
    createOptions.push({
      label: 'New Organization',
      description: 'Create a new organization',
      icon: Building2,
      onClick: () => setOrganizationFormOpen(true),
      shortcut: '⌘O'
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            className="rounded-full w-10 h-10 p-0 flex items-center justify-center transition-all duration-200 hover:scale-105 focus:scale-105" 
            style={{ backgroundColor: '#d7c5fb' }}
          >
            <Plus className="h-4 w-4 text-gray-800" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {createOptions.map((option) => {
            const Icon = option.icon
            return (
              <DropdownMenuItem
                key={option.label}
                onClick={option.onClick}
                className="flex items-center gap-3 p-3 cursor-pointer"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-muted-foreground">{option.description}</div>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {option.shortcut}
                </div>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Job Wizard */}
      <JobWizard
        isOpen={jobWizardOpen}
        onClose={() => setJobWizardOpen(false)}
      />

      {/* Candidate Form Sheet */}
      <CandidateFormSheet
        isOpen={candidateSheetOpen}
        onClose={() => setCandidateSheetOpen(false)}
        onSubmit={handleCandidateSubmit}
        isLoading={isCreatingCandidate}
      />

      {/* Organization Form */}
      {isPlatformAdmin && (
        <OrganizationFormSheet
          isOpen={organizationFormOpen}
          onClose={() => setOrganizationFormOpen(false)}
          onSubmit={async (data) => {
            await createOrganization(data as CreateOrganizationData)
            setOrganizationFormOpen(false)
          }}
          isLoading={isCreatingOrg}
        />
      )}
    </>
  )
}