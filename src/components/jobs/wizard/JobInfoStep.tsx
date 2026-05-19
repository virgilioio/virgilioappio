import React from 'react'
import { Building2, Globe, Briefcase, MapPin, TrendingUp, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencySelect } from '@/components/ui/currency-select'
import { Button } from '@/components/ui/button'
import {
  SectionCard,
  FieldLabel,
  FieldHint,
  Segmented,
  ToggleRow,
  ChipInput,
  SalaryInput,
  AiAssistedBadge,
} from './_parts'
import { CreateJobData, JobWorkMode, JobEmploymentType } from '@/hooks/useJobs'
import { useChildOrganizationsForJobCreation } from '@/hooks/useChildOrganizationsForJobCreation'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { OrganizationFormSheet } from '@/components/organizations/OrganizationFormSheet'
import { useOrganizations } from '@/hooks/useOrganizations'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface JobInfoStepProps {
  jobData: Partial<CreateJobData>
  onUpdate: (data: Partial<CreateJobData>) => void
}

type JobStatus = 'draft' | 'open' | 'closed' | 'archived'

const STATUS_OPTIONS = [
  { value: 'draft' as JobStatus, label: 'Draft' },
  { value: 'open' as JobStatus, label: 'Open' },
  { value: 'closed' as JobStatus, label: 'Closed' },
  { value: 'archived' as JobStatus, label: 'Archived' },
]

const WORK_MODE_OPTIONS: { value: JobWorkMode; label: string; icon: React.ComponentType<any> }[] = [
  { value: 'remote', label: 'Remote', icon: Globe },
  { value: 'hybrid', label: 'Hybrid', icon: Building2 },
  { value: 'onsite', label: 'On-site', icon: MapPin },
]

const EMPLOYMENT_TYPE_OPTIONS: { value: JobEmploymentType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'temporary', label: 'Temporary' },
]

const JOB_LEVEL_OPTIONS: SearchableSelectOption[] = [
  { value: 'L1 — Specialists', label: 'L1 — Specialists' },
  { value: 'L2 — Senior Specialists', label: 'L2 — Senior Specialists' },
  { value: 'L3 — Staff', label: 'L3 — Staff' },
  { value: 'L4 — Principal', label: 'L4 — Principal' },
  { value: 'L5 — Manager', label: 'L5 — Manager' },
  { value: 'L6 — Director', label: 'L6 — Director' },
  { value: 'L7 — VP', label: 'L7 — VP' },
  { value: 'L8 — Executive', label: 'L8 — Executive' },
]

export function JobInfoStep({ jobData, onUpdate }: JobInfoStepProps) {
  const [isOrgFormOpen, setIsOrgFormOpen] = React.useState(false)
  const { data: childOrgs = [], isLoading: isLoadingOrgs, refetch: refetchOrgs } = useChildOrganizationsForJobCreation()
  const { userType, organizationId } = useAuth()
  const permissions = usePermissions()
  const { createOrganization, isLoading: isCreatingOrg } = useOrganizations()

  const organizationOptions: SearchableSelectOption[] = React.useMemo(
    () =>
      childOrgs
        .map((org) => ({ value: org.id, label: org.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [childOrgs]
  )

  const canSelectOrganization = permissions.isPlatformAdmin || permissions.isWorkspaceOwner

  React.useEffect(() => {
    if (!jobData.organization_id && userType !== 'platform_admin' && organizationId) {
      onUpdate({ organization_id: organizationId })
    }
  }, [jobData.organization_id, userType, organizationId, onUpdate])

  // Defaults
  React.useEffect(() => {
    const patch: Partial<CreateJobData> = {}
    if (jobData.show_salary_public === undefined) patch.show_salary_public = true
    if (jobData.status === undefined) patch.status = 'draft'
    if (jobData.currency === undefined) patch.currency = 'USD'
    if (Object.keys(patch).length) onUpdate(patch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = <K extends keyof CreateJobData>(field: K, value: CreateJobData[K]) =>
    onUpdate({ [field]: value } as Partial<CreateJobData>)

  const handleCreateOrganization = async (data: any) => {
    try {
      const result = await createOrganization(data)
      await refetchOrgs()
      setIsOrgFormOpen(false)
      if (result && typeof result === 'object' && 'id' in result) {
        onUpdate({ organization_id: (result as { id: string }).id })
      }
    } catch (error) {
      console.error('Failed to create organization:', error)
    }
  }

  const salaryInvalid =
    jobData.salary_min != null &&
    jobData.salary_max != null &&
    jobData.salary_min > jobData.salary_max

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------ BASICS */}
      <SectionCard title="Basics">
        <div>
          <FieldLabel htmlFor="title" required>
            Job title
          </FieldLabel>
          <Input
            id="title"
            value={jobData.title || ''}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Senior Product Designer"
            className="mt-2"
          />
          <FieldHint>The public-facing title candidates will see.</FieldHint>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <FieldLabel htmlFor="internal_title" optional>
              Internal title
            </FieldLabel>
            <Input
              id="internal_title"
              value={jobData.internal_title || ''}
              onChange={(e) => set('internal_title', e.target.value)}
              placeholder="e.g. Sr. PD, Design Systems"
              className="mt-2"
            />
            <FieldHint>Used in CRM &amp; analytics only.</FieldHint>
          </div>

          <div>
            <FieldLabel required>Status</FieldLabel>
            <div className="mt-2">
              <Segmented
                ariaLabel="Job status"
                options={STATUS_OPTIONS}
                value={(jobData.status as JobStatus) || 'draft'}
                onChange={(v) => set('status', v)}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {canSelectOrganization && (
            <div>
              <FieldLabel required>Department / Organization</FieldLabel>
              <div className="mt-2">
                <SearchableSelect
                  options={organizationOptions}
                  value={jobData.organization_id || ''}
                  onValueChange={(value) => set('organization_id', value)}
                  placeholder={isLoadingOrgs ? 'Loading…' : 'Select a department…'}
                  searchPlaceholder="Search departments…"
                  emptyMessage="No departments found."
                  disabled={isLoadingOrgs}
                  onCreateNew={() => setIsOrgFormOpen(true)}
                  createNewLabel="Create Department"
                />
              </div>
              <FieldHint>Which child org owns this req.</FieldHint>
            </div>
          )}

          <div>
            <FieldLabel>Job level</FieldLabel>
            <div className="mt-2">
              <SearchableSelect
                options={JOB_LEVEL_OPTIONS}
                value={jobData.job_level || ''}
                onValueChange={(value) => set('job_level', value)}
                placeholder="Select level…"
                searchPlaceholder="Search levels…"
                emptyMessage="No levels."
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ----------------------------------- LOCATION & EMPLOYMENT */}
      <SectionCard title="Location & Employment">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <FieldLabel required>Work mode</FieldLabel>
            <Select
              value={jobData.work_mode || ''}
              onValueChange={(v) => set('work_mode', v as JobWorkMode)}
            >
              <SelectTrigger className="mt-2 h-11">
                <SelectValue placeholder="Select work mode…" />
              </SelectTrigger>
              <SelectContent>
                {WORK_MODE_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-text-tertiary" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel required>Employment type</FieldLabel>
            <Select
              value={jobData.employment_type || ''}
              onValueChange={(v) => set('employment_type', v as JobEmploymentType)}
            >
              <SelectTrigger className="mt-2 h-11">
                <SelectValue placeholder="Select employment type…" />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="inline-flex items-center gap-2">
                      <Briefcase className="h-3.5 w-3.5 text-text-tertiary" />
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <FieldLabel htmlFor="location">Primary location</FieldLabel>
            <div className="relative mt-2">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
              <Input
                id="location"
                value={jobData.location || ''}
                onChange={(e) => set('location', e.target.value)}
                placeholder="e.g. New York, NY"
                className="pl-9"
              />
            </div>
            <FieldHint>City, state — or 'Remote'.</FieldHint>
          </div>

          <div>
            <FieldLabel optional>Additional locations</FieldLabel>
            <div className="mt-2">
              <ChipInput
                values={jobData.additional_locations || []}
                onChange={(next) => set('additional_locations', next)}
                placeholder="Add location…"
                tone="purple"
              />
            </div>
            <FieldHint>Cities where the role may sit on-site.</FieldHint>
          </div>
        </div>
      </SectionCard>

      {/* ------------------------------------------- COMPENSATION */}
      <SectionCard title="Compensation">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <FieldLabel required>Currency</FieldLabel>
            <div className="mt-2">
              <CurrencySelect
                value={jobData.currency || ''}
                onChange={(v) => set('currency', v)}
              />
            </div>
          </div>

          <div>
            <FieldLabel required>Min salary</FieldLabel>
            <div className="mt-2">
              <SalaryInput
                value={jobData.salary_min ?? undefined}
                onChange={(v) => set('salary_min', v)}
                placeholder="80,000"
                invalid={salaryInvalid}
              />
            </div>
            {salaryInvalid && <FieldHint tone="error">Min must be lower than max</FieldHint>}
          </div>

          <div>
            <FieldLabel required>Max salary</FieldLabel>
            <div className="mt-2">
              <SalaryInput
                value={jobData.salary_max ?? undefined}
                onChange={(v) => set('salary_max', v)}
                placeholder="120,000"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-virgilio-border pt-4 space-y-1">
          <ToggleRow
            label="Show salary on public posting"
            hint="Recommended — applicant quality jumps 40% on jobs that publish salary."
            checked={!!jobData.show_salary_public}
            onChange={(v) => set('show_salary_public', v)}
          />
          <ToggleRow
            label="Include equity"
            checked={!!jobData.include_equity}
            onChange={(v) => set('include_equity', v)}
          />
          <ToggleRow
            label="Include signing bonus"
            checked={!!jobData.include_signing_bonus}
            onChange={(v) => set('include_signing_bonus', v)}
          />
        </div>
      </SectionCard>

      {/* ----------------------------------------- JOB DESCRIPTION */}
      <SectionCard
        title="Job description"
        trailing={
          <Button variant="ghost" size="xs" icon={Sparkles} className="text-virgilio-purple">
            Generate with Gio
          </Button>
        }
      >
        <div>
          <FieldLabel htmlFor="description" required>
            Description
          </FieldLabel>
          <Textarea
            id="description"
            value={jobData.description || ''}
            onChange={(e) => set('description', e.target.value)}
            placeholder="## About the role
We're hiring a…

## What you'll do
- …

## What we're looking for
- …"
            className="mt-2 min-h-[220px] font-inter text-[13px] leading-relaxed"
          />
          <FieldHint>Markdown supported. Includes overview, responsibilities, requirements.</FieldHint>
        </div>
      </SectionCard>

      {/* ------------------------------------------ REQUIRED SKILLS */}
      <SectionCard title="Required skills">
        <div>
          <FieldLabel required>Skills</FieldLabel>
          <div className="mt-2">
            <ChipInput
              values={jobData.skills || []}
              onChange={(next) => set('skills', next)}
              placeholder="Add skill…"
              tone="purple"
            />
          </div>
          <FieldHint>Used for AI matching when sourcing and reviewing applications. Press Enter to add.</FieldHint>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <FieldLabel>Min years of experience</FieldLabel>
            <div className="relative mt-2">
              <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
              <Input
                type="number"
                min={0}
                value={jobData.min_years_experience ?? ''}
                onChange={(e) =>
                  set('min_years_experience', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="0"
                className="pl-9 pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-text-tertiary pointer-events-none">
                years
              </span>
            </div>
          </div>
          <div>
            <FieldLabel optional>Max years</FieldLabel>
            <div className="relative mt-2">
              <Input
                type="number"
                min={0}
                value={jobData.max_years_experience ?? ''}
                onChange={(e) =>
                  set('max_years_experience', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="—"
                className="pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-text-tertiary pointer-events-none">
                years
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Organization Creation Sheet */}
      <OrganizationFormSheet
        isOpen={isOrgFormOpen}
        onClose={() => setIsOrgFormOpen(false)}
        onSubmit={handleCreateOrganization}
        isLoading={isCreatingOrg}
      />
    </div>
  )
}

// Convenience re-export so JobWizard can render the badge in the header
export { AiAssistedBadge }
