import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { CandidateMergeDialog } from '@/components/candidates/CandidateMergeDialog'
import { OrganizationFormSheet } from '@/components/organizations/OrganizationFormSheet'
import { useOrganizations, type CreateOrganizationData } from '@/hooks/useOrganizations'
import { useIndependentCandidates, CreateIndependentCandidateData, IndependentCandidate } from '@/hooks/useIndependentCandidates'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'

export function GlobalCreateButton() {
  const navigate = useNavigate()
  const { canCreateJobs, canCreateCandidates, isPlatformAdmin } = usePermissions()
  const [jobWizardOpen, setJobWizardOpen] = useState(false)
  const [candidateSheetOpen, setCandidateSheetOpen] = useState(false)
  const [organizationFormOpen, setOrganizationFormOpen] = useState(false)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existing: any
    incoming: any
    merged: any
    assignedJobId?: string
    assignedStageId?: string
  } | null>(null)
  const { createOrganization, isLoading: isCreatingOrg } = useOrganizations()
  const { addCandidate, updateCandidate, isLoading: isCreatingCandidate } = useIndependentCandidates()

  // Handle candidate submission with job assignment logic
  const handleCandidateSubmit = async (candidateData: CreateIndependentCandidateData & { assignedJobId?: string; assignedStageId?: string }) => {
    try {
      // Create the candidate first
      const result = await addCandidate(candidateData)
      
      // Check if duplicate was detected
      if (result && 'isDuplicate' in result) {
        // Show merge dialog
        setDuplicateInfo({
          existing: result.existingCandidate,
          incoming: result.incomingData,
          merged: result.mergedData,
          assignedJobId: candidateData.assignedJobId,
          assignedStageId: candidateData.assignedStageId
        })
        setShowMergeDialog(true)
        return
      }
      
      const newCandidate = result as IndependentCandidate
      
      // If job is assigned, create the job-candidate association
      if (candidateData.assignedJobId && newCandidate && newCandidate.id) {
        // Check if association already exists
        const { data: existingAssoc } = await supabase
          .from('job_candidate_associations')
          .select('id')
          .eq('job_id', candidateData.assignedJobId)
          .eq('candidate_id', newCandidate.id)
          .maybeSingle()
        
        if (existingAssoc) {
          toast({
            title: 'Success',
            description: 'Candidate created and assigned to job successfully!'
          })
        } else {
          // Create new association
          const { error: associationError } = await supabase
            .from('job_candidate_associations')
            .insert({
              job_id: candidateData.assignedJobId,
              candidate_id: newCandidate.id,
              current_stage_id: candidateData.assignedStageId || null,
              status: 'active',
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
        }
        // Navigate to the job page and open the candidate profile
        navigate(`/jobs/${candidateData.assignedJobId}?candidate=${newCandidate.id}`)
      } else {
        toast({
          title: 'Success',
          description: 'Candidate created successfully!'
        })
        // Navigate to candidates page and open the candidate profile sheet
        if (newCandidate?.id) {
          navigate(`/candidates?openCandidate=${newCandidate.id}`)
        } else {
          navigate('/candidates')
        }
      }
      
      setCandidateSheetOpen(false)
      return newCandidate
    } catch (error) {
      console.error('Error creating candidate:', error)
      // Error handling is done in the hook
    }
  }

  // Handle merge confirmation
  const handleMergeConfirm = async () => {
    if (!duplicateInfo) return
    
    try {
      // Update the existing candidate with merged data
      await updateCandidate(duplicateInfo.existing.id, duplicateInfo.merged)
      
      // If job assignment was requested, create the association
      if (duplicateInfo.assignedJobId) {
        // Check if association already exists
        const { data: existingAssoc } = await supabase
          .from('job_candidate_associations')
          .select('id')
          .eq('job_id', duplicateInfo.assignedJobId)
          .eq('candidate_id', duplicateInfo.existing.id)
          .maybeSingle()
        
        if (!existingAssoc) {
          const { error: associationError } = await supabase
            .from('job_candidate_associations')
            .insert({
              job_id: duplicateInfo.assignedJobId,
              candidate_id: duplicateInfo.existing.id,
              current_stage_id: duplicateInfo.assignedStageId || null,
              status: 'active',
              added_by: (await supabase.auth.getUser()).data.user?.id
            })

          if (associationError) {
            console.error('Error creating job association:', associationError)
            toast({
              title: 'Warning',
              description: 'Candidate merged but could not be assigned to job.',
              variant: 'destructive'
            })
          } else {
            toast({
              title: 'Success',
              description: 'Candidate merged and assigned to job successfully!'
            })
          }
        } else {
          toast({
            title: 'Success',
            description: 'Candidate merged successfully!'
          })
        }
      } else {
        toast({
          title: 'Success',
          description: 'Candidate merged successfully!'
        })
      }
      
      setShowMergeDialog(false)
      setCandidateSheetOpen(false)
      navigate('/candidates')
    } catch (error) {
      console.error('Error merging candidate:', error)
      toast({
        title: 'Error',
        description: 'Failed to merge candidate',
        variant: 'destructive'
      })
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
      label: 'New Department',
      description: 'Create a new department',
      icon: Building2,
      onClick: () => setOrganizationFormOpen(true),
      shortcut: '⌘O'
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Create"
            className="inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-lg bg-white text-[#0d0d09] font-poppins font-semibold text-[12.5px] tracking-[-0.01em] hover:bg-[#FAFAF7] active:bg-[#F1F0EC] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/40"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {createOptions.map((option) => {
            const Icon = option.icon
            return (
              <DropdownMenuItem
                key={option.label}
                onClick={option.onClick}
              >
                <Icon className="h-3.5 w-3.5 text-[hsl(var(--menu-group-color))]" />
                <span className="flex-1 truncate">{option.label}</span>
                <span className="ml-auto font-mono text-menu-kbd text-[hsl(var(--menu-group-color))]">
                  {option.shortcut}
                </span>
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

      {/* Merge Dialog */}
      {duplicateInfo && (
        <CandidateMergeDialog
          isOpen={showMergeDialog}
          onConfirm={handleMergeConfirm}
          onCancel={() => {
            setShowMergeDialog(false)
            setDuplicateInfo(null)
          }}
          existingCandidate={duplicateInfo.existing}
          newCandidate={duplicateInfo.incoming}
          mergedCandidate={duplicateInfo.merged}
        />
      )}
    </>
  )
}