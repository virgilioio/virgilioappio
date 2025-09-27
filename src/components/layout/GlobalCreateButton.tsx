import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Briefcase, Users } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { JobWizard } from '@/components/jobs/JobWizard'
import CandidateFormSheet from '@/components/candidates/CandidateFormSheet'

export function GlobalCreateButton() {
  const { canCreateJobs, canCreateCandidates } = usePermissions()
  const [jobWizardOpen, setJobWizardOpen] = useState(false)
  const [candidateSheetOpen, setCandidateSheetOpen] = useState(false)

  // Don't render if user has no create permissions
  if (!canCreateJobs && !canCreateCandidates) {
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
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canCreateJobs, canCreateCandidates])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create</span>
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
      />
    </>
  )
}