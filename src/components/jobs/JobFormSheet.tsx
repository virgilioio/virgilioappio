import { useState, useEffect, useMemo } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Job, CreateJobData, UpdateJobData } from '@/hooks/useJobs'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useMembers } from '@/hooks/useMembers'
import { useAuth } from '@/contexts/AuthContext'
import { CurrencySelect } from '@/components/ui/currency-select'
import type { CategorizedSkill } from '@/hooks/useSkillsGeneration'
import { JobSkillsGenerationPanel } from './JobSkillsGenerationPanel'
import { getSkillColor } from '@/utils/skillColors'
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select'
import { OrganizationFormSheet } from '@/components/organizations/OrganizationFormSheet'

interface JobFormSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateJobData | UpdateJobData) => Promise<void>
  job?: Job | null
  isLoading: boolean
}

type JobLevel = 'L1 - Specialists' | 'L2 - Managers' | 'L3 - Directors / VPs / Executive Search' | 'L4 - C-Level'
type JobStatus = 'draft' | 'open' | 'closed' | 'archived'

export function JobFormSheet({ isOpen, onClose, onSubmit, job, isLoading }: JobFormSheetProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    salary_min: '',
    salary_max: '',
    currency: 'USD',
    status: 'draft' as JobStatus,
    organization_id: '',
    hiring_team: [] as string[]
  })

  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [autoSkills, setAutoSkills] = useState<CategorizedSkill[]>([])
  const [descriptionIsExternalUpdate, setDescriptionIsExternalUpdate] = useState(false)

  const [hiringTeamOpen, setHiringTeamOpen] = useState(false)
  const [isOrgFormOpen, setIsOrgFormOpen] = useState(false)

  const { organizations, createOrganization, isLoading: isCreatingOrg } = useOrganizations()
  const { members } = useMembers()
  const { userType, organizationId } = useAuth()

  // Filter to only show child organizations (jobs must reference child orgs only)
  const childOrganizations = useMemo(
    () => organizations.filter(org => org.parent_organization_id !== null),
    [organizations]
  )

  // Create options for SearchableSelect
  const organizationOptions: SearchableSelectOption[] = useMemo(
    () => childOrganizations.map(org => ({ value: org.id, label: org.name })),
    [childOrganizations]
  )

  // Handle organization creation
  const handleCreateOrganization = async (data: { name?: string; status?: string }) => {
    if (!data.name) return
    const result = await createOrganization({ 
      name: data.name, 
      status: (data.status as 'active' | 'inactive') || 'active'
    })
    if (result && typeof result === 'object' && 'id' in result) {
      setFormData(prev => ({ ...prev, organization_id: result.id }))
    }
    setIsOrgFormOpen(false)
  }

  useEffect(() => {
    if (job) {
      // Editing existing job - populate all fields from job data
      setFormData({
        title: job.title,
        description: job.description || '',
        location: job.location || '',
        salary_min: job.salary_min?.toString() || '',
        salary_max: job.salary_max?.toString() || '',
        currency: job.currency || 'USD',
        status: job.status,
        organization_id: job.organization_id,
        hiring_team: job.hiring_team || []
      })
      setSelectedSkills(job.skills || [])
      setDescriptionIsExternalUpdate(true)
    } else {
      // Creating new job - set appropriate default organization
      let defaultOrganizationId = ''
      
      if (userType === 'platform_admin') {
        // Platform admins: don't auto-select, force them to choose
        defaultOrganizationId = ''
      } else if (organizationId) {
        // Regular users: default to their organization (if it's a child org)
        const isChildOrg = childOrganizations.some(org => org.id === organizationId)
        defaultOrganizationId = isChildOrg ? organizationId : ''
      } else if (childOrganizations.length > 0) {
        // Fallback: use first available child organization
        defaultOrganizationId = childOrganizations[0].id
      }

      setFormData(prev => ({
        ...prev,
        organization_id: defaultOrganizationId
      }))
      setSelectedSkills([])
      setAutoSkills([])
      setDescriptionIsExternalUpdate(false)
    }
  }, [job, childOrganizations, userType, organizationId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate organization is selected
    if (!formData.organization_id) {
      return // Button should be disabled, but extra safety
    }
    
    const submitData = {
      title: formData.title,
      description: formData.description || null,
      location: formData.location || null,
      salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
      salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
      currency: formData.currency || null,
      status: formData.status,
      organization_id: formData.organization_id,
      skills: selectedSkills,
      auto_generated_skills: autoSkills.length > 0 ? autoSkills : undefined,
      last_skills_generation: autoSkills.length > 0 ? new Date().toISOString() : undefined,
      hiring_team: formData.hiring_team
    }

    try {
      await onSubmit(submitData)
      onClose()
      // Reset form
      const defaultOrgId = userType === 'platform_admin' ? '' : (organizationId || childOrganizations[0]?.id || '')
      setFormData({
        title: '',
        description: '',
        location: '',
        salary_min: '',
        salary_max: '',
        currency: 'USD',
        status: 'draft',
        organization_id: defaultOrgId,
        hiring_team: []
      })
      setSelectedSkills([])
      setAutoSkills([])
      setDescriptionIsExternalUpdate(false)
    } catch (error) {
      // Error is handled in the hook
    }
  }

  const handleAddMember = (memberId: string) => {
    if (!formData.hiring_team.includes(memberId)) {
      setFormData(prev => ({
        ...prev,
        hiring_team: [...prev.hiring_team, memberId]
      }))
    }
    setHiringTeamOpen(false)
  }

  const handleRemoveMember = (memberId: string) => {
    setFormData(prev => ({
      ...prev,
      hiring_team: prev.hiring_team.filter(id => id !== memberId)
    }))
  }

  const getSelectedMembers = () => {
    return members.filter(member => formData.hiring_team.includes(member.id))
  }

  const getAvailableMembers = () => {
    return members.filter(member => !formData.hiring_team.includes(member.id))
  }

  return (
    <>
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[640px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-h4-mobile font-poppins font-bold text-virgilio-text tracking-page-title">
            {job ? 'Edit Job' : 'Create New Job'}<span className="text-purple-period">.</span>
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto pr-2">
          <form id="job-form" onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Senior Frontend Developer"
                required
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as JobStatus }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g. San Francisco, CA"
              />
            </div>

            <div>
              <Label htmlFor="salary_min">Min Salary</Label>
              <Input
                id="salary_min"
                type="number"
                value={formData.salary_min}
                onChange={(e) => setFormData(prev => ({ ...prev, salary_min: e.target.value }))}
                placeholder="80000"
              />
            </div>

            <div>
              <Label htmlFor="salary_max">Max Salary</Label>
              <Input
                id="salary_max"
                type="number"
                value={formData.salary_max}
                onChange={(e) => setFormData(prev => ({ ...prev, salary_max: e.target.value }))}
                placeholder="120000"
              />
            </div>

            <div>
              <Label htmlFor="currency">Currency</Label>
              <CurrencySelect
                value={formData.currency}
                onChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
              />
            </div>

            <div>
              <Label htmlFor="organization">Department / Organization *</Label>
              <SearchableSelect
                options={organizationOptions}
                value={formData.organization_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, organization_id: value }))}
                placeholder="Select department or organization"
                searchPlaceholder="Search departments..."
                emptyMessage="No departments available."
                onCreateNew={() => setIsOrgFormOpen(true)}
                createNewLabel="Create Department"
              />
              {!formData.organization_id && childOrganizations.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {userType === 'platform_admin' 
                    ? 'Platform admins must select a department' 
                    : 'Please select a department'}
                </p>
              )}
              {childOrganizations.length === 0 && (
                <p className="text-sm text-destructive mt-1">
                  No departments available. Contact your administrator.
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">Job Description</Label>
              <RichTextEditor
                key={job?.id || 'new-job'}
                value={formData.description}
                onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                placeholder="Describe the role, responsibilities, and requirements..."
                minHeight="300px"
                className="mt-1"
                isExternalUpdate={descriptionIsExternalUpdate}
                onExternalUpdateComplete={() => setDescriptionIsExternalUpdate(false)}
              />
            </div>

            <div className="md:col-span-2">
              <Label>Required Skills</Label>
              <div className="mt-2 mb-3">
                {selectedSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedSkills.map((skill) => (
                      <Badge key={skill} variant={getSkillColor(skill)} className="flex items-center gap-1">
                        {skill}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedSkills(selectedSkills.filter(s => s !== skill))} />
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">No skills selected yet</p>
                )}
              </div>
              <JobSkillsGenerationPanel
                descriptionHtml={formData.description}
                title={formData.title}
                existingSkills={selectedSkills}
                onAccept={(skills) => setSelectedSkills(skills)}
                onGenerated={(items) => setAutoSkills(items)}
              />
            </div>

            <div className="md:col-span-2">
              <Label>Hiring Team</Label>
              <div className="space-y-3">
                {/* Selected Members */}
                {getSelectedMembers().length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {getSelectedMembers().map(member => (
                      <Badge key={member.id} variant="secondary" className="flex items-center gap-1">
                        {member.user_email || 'Unknown'} ({member.system_role === 'admin' ? 'Admin' : 'Member'})
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => handleRemoveMember(member.id)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* Add Member Dropdown */}
                <Popover open={hiringTeamOpen} onOpenChange={setHiringTeamOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={hiringTeamOpen}
                      className="w-full justify-between"
                    >
                      Add team member...
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search team members..." />
                      <CommandList>
                        <CommandEmpty>No team members found.</CommandEmpty>
                        <CommandGroup>
                          {getAvailableMembers().map((member) => (
                            <CommandItem
                              key={member.id}
                              onSelect={() => handleAddMember(member.id)}
                              className="cursor-pointer"
                            >
                              <div className="flex flex-col">
                                <span>{member.user_email || 'Unknown'}</span>
                                <span className="text-sm text-muted-foreground">
                                  {member.member_role} • {member.organization_name || 'No org'}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          </form>
        </div>

        <div className="border-t pt-4 mt-4 bg-background flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit"
            form="job-form"
            disabled={isLoading || !formData.organization_id}
            title={!formData.organization_id ? 'Organization selection required' : ''}
          >
            {isLoading ? 'Saving...' : (job ? 'Update Job' : 'Create Job')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>

    {/* Organization Creation Form */}
    <OrganizationFormSheet
      isOpen={isOrgFormOpen}
      onClose={() => setIsOrgFormOpen(false)}
      onSubmit={handleCreateOrganization}
      isLoading={isCreatingOrg}
    />
  </>
  )
}