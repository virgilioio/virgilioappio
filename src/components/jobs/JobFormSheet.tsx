import { useState, useEffect } from 'react'
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
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Job, CreateJobData, UpdateJobData } from '@/hooks/useJobs'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useMembers } from '@/hooks/useMembers'
import { useAuth } from '@/contexts/AuthContext'
import { CURRENCIES } from '@/constants/currencies'
import type { CategorizedSkill } from '@/hooks/useSkillsGeneration'
import { JobSkillsGenerationPanel } from './JobSkillsGenerationPanel'
import { getSkillColor } from '@/utils/skillColors'

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
    department: '',
    level: 'L1 - Specialists' as JobLevel,
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

  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [hiringTeamOpen, setHiringTeamOpen] = useState(false)

  const { organizations } = useOrganizations()
  const { members } = useMembers()
  const { userType, organizationId } = useAuth()

  useEffect(() => {
    if (job) {
      // Editing existing job - populate all fields from job data
      setFormData({
        title: job.title,
        description: job.description || '',
        department: job.department || '',
        level: job.level,
        location: job.location || '',
        salary_min: job.salary_min?.toString() || '',
        salary_max: job.salary_max?.toString() || '',
        currency: job.currency || 'USD',
        status: job.status,
        organization_id: job.organization_id,
        hiring_team: job.hiring_team || []
      })
      setSelectedSkills(job.skills || [])
    } else {
      // Creating new job - set appropriate default organization
      let defaultOrganizationId = ''
      
      if (userType === 'platform_admin') {
        // Platform admins: don't auto-select, force them to choose
        defaultOrganizationId = ''
      } else if (organizationId) {
        // Regular users: default to their organization
        defaultOrganizationId = organizationId
      } else if (organizations.length > 0) {
        // Fallback: use first available organization
        defaultOrganizationId = organizations[0].id
      }

      setFormData(prev => ({
        ...prev,
        organization_id: defaultOrganizationId
      }))
      setSelectedSkills([])
      setAutoSkills([])
    }
  }, [job, organizations, userType, organizationId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate organization is selected
    if (!formData.organization_id) {
      return // Button should be disabled, but extra safety
    }
    
    const submitData = {
      title: formData.title,
      description: formData.description || null,
      department: formData.department || null,
      level: formData.level,
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
      const defaultOrgId = userType === 'platform_admin' ? '' : (organizationId || organizations[0]?.id || '')
      setFormData({
        title: '',
        description: '',
        department: '',
        level: 'L1 - Specialists',
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
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:w-[800px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-h4-mobile font-poppins font-bold text-virgilio-text tracking-page-title">
            {job ? 'Edit Job' : 'Create New Job'}<span className="text-purple-period">.</span>
          </SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
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
              <Label htmlFor="level">Level *</Label>
              <Select value={formData.level} onValueChange={(value) => setFormData(prev => ({ ...prev, level: value as JobLevel }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1 - Specialists">L1 - Specialists</SelectItem>
                  <SelectItem value="L2 - Managers">L2 - Managers</SelectItem>
                  <SelectItem value="L3 - Directors / VPs / Executive Search">L3 - Directors / VPs / Executive Search</SelectItem>
                  <SelectItem value="L4 - C-Level">L4 - C-Level</SelectItem>
                </SelectContent>
              </Select>
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
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                placeholder="e.g. Engineering"
              />
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
              <Popover open={currencyOpen} onOpenChange={setCurrencyOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={currencyOpen}
                    className="w-full justify-between"
                  >
                    {formData.currency
                      ? CURRENCIES.find((currency) => currency.value === formData.currency)?.label
                      : "Select currency..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search currency..." />
                    <CommandList>
                      <CommandEmpty>No currency found.</CommandEmpty>
                      <CommandGroup>
                        {CURRENCIES.map((currency) => (
                          <CommandItem
                            key={currency.value}
                            value={currency.value}
                            onSelect={(currentValue) => {
                              setFormData(prev => ({ ...prev, currency: currentValue.toUpperCase() }))
                              setCurrencyOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.currency === currency.value ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {currency.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="organization">Organization *</Label>
              <Select 
                value={formData.organization_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, organization_id: value }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {userType === 'platform_admin' && !formData.organization_id && (
                <p className="text-sm text-muted-foreground mt-1">
                  Platform admins must select an organization
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
                isExternalUpdate={!!job}
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
                        {member.user_email || 'Unknown'} ({member.member_role})
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

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !formData.organization_id}
              title={!formData.organization_id ? 'Organization selection required' : ''}
            >
              {isLoading ? 'Saving...' : (job ? 'Update Job' : 'Create Job')}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}