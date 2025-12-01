import React from 'react'
import { useForm } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CreateJobData } from '@/hooks/useJobs'
import { useChildOrganizationsForJobCreation } from '@/hooks/useChildOrganizationsForJobCreation'
import { useAuth } from '@/contexts/AuthContext'
import { CURRENCIES } from '@/constants/currencies'
import { usePermissions } from '@/hooks/usePermissions'
import { OrganizationFormSheet } from '@/components/organizations/OrganizationFormSheet'
import { useOrganizations } from '@/hooks/useOrganizations'

interface JobInfoStepProps {
  jobData: Partial<CreateJobData>
  onUpdate: (data: Partial<CreateJobData>) => void
}

type JobStatus = 'draft' | 'open' | 'closed' | 'archived'

export function JobInfoStep({ jobData, onUpdate }: JobInfoStepProps) {
  const [currencyOpen, setCurrencyOpen] = React.useState(false)
  const [isOrgFormOpen, setIsOrgFormOpen] = React.useState(false)
  const { data: childOrgs = [], isLoading: isLoadingOrgs, refetch: refetchOrgs } = useChildOrganizationsForJobCreation()
  const { userType, organizationId } = useAuth()
  const permissions = usePermissions()
  const { createOrganization, isLoading: isCreatingOrg } = useOrganizations()

  // Transform child orgs for SearchableSelect
  const organizationOptions: SearchableSelectOption[] = React.useMemo(() => 
    childOrgs
      .map(org => ({ value: org.id, label: org.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [childOrgs]
  )
  
  // Show org selector for platform admins, workspace owners, and recruiters
  const canSelectOrganization = permissions.isPlatformAdmin || permissions.isWorkspaceOwner || permissions.isRecruiter

  React.useEffect(() => {
    // Set default organization for non-platform-admin users
    if (!jobData.organization_id && userType !== 'platform_admin' && organizationId) {
      onUpdate({ organization_id: organizationId })
    }
  }, [jobData.organization_id, userType, organizationId, onUpdate])

  const handleInputChange = (field: keyof CreateJobData, value: any) => {
    onUpdate({ [field]: value })
  }

  const handleCreateOrganization = async (data: any) => {
    try {
      const result = await createOrganization(data)
      await refetchOrgs()
      setIsOrgFormOpen(false)
      // Auto-select the newly created organization
      if (result && typeof result === 'object' && 'id' in result) {
        onUpdate({ organization_id: result.id })
      }
    } catch (error) {
      console.error('Failed to create organization:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Job Title */}
        <div className="col-span-2 space-y-2">
          <Label htmlFor="title">Job Title *</Label>
          <Input
            id="title"
            value={jobData.title || ''}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="e.g. Senior Frontend Developer"
            required
          />
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select 
            value={jobData.status || 'draft'} 
            onValueChange={(value) => handleInputChange('status', value as JobStatus)}
          >
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

        {/* Department / Organization - Only show for users who can select org */}
        {canSelectOrganization && (
          <div className="space-y-2">
            <Label htmlFor="organization">
              Department / Organization <span className="text-red-500">*</span>
            </Label>
            <SearchableSelect
              options={organizationOptions}
              value={jobData.organization_id || ''}
              onValueChange={(value) => handleInputChange('organization_id', value)}
              placeholder={isLoadingOrgs ? "Loading departments..." : "Select a department..."}
              searchPlaceholder="Search departments..."
              emptyMessage="No departments found."
              disabled={isLoadingOrgs}
              onCreateNew={() => setIsOrgFormOpen(true)}
              createNewLabel="Create Department"
            />
            <p className="text-xs text-muted-foreground">
              Select which department or client this job belongs to
            </p>
          </div>
        )}

        {/* Location */}
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={jobData.location || ''}
            onChange={(e) => handleInputChange('location', e.target.value)}
            placeholder="e.g. San Francisco, CA"
          />
        </div>

        {/* Min Salary */}
        <div className="space-y-2">
          <Label htmlFor="salary_min">Min Salary</Label>
          <Input
            id="salary_min"
            type="number"
            value={jobData.salary_min?.toString() || ''}
            onChange={(e) => handleInputChange('salary_min', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="80000"
          />
        </div>

        {/* Max Salary */}
        <div className="space-y-2">
          <Label htmlFor="salary_max">Max Salary</Label>
          <Input
            id="salary_max"
            type="number"
            value={jobData.salary_max?.toString() || ''}
            onChange={(e) => handleInputChange('salary_max', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="120000"
          />
        </div>

        {/* Currency */}
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Popover open={currencyOpen} onOpenChange={setCurrencyOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={currencyOpen}
                className="w-full justify-between"
              >
                {jobData.currency
                  ? CURRENCIES.find((currency) => currency.value === jobData.currency)?.label
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
                          handleInputChange('currency', currentValue.toUpperCase())
                          setCurrencyOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            jobData.currency === currency.value ? "opacity-100" : "opacity-0"
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
      </div>

      <div className="mt-6 p-4 bg-muted rounded-lg">
        <h4 className="text-sm font-medium text-text-primary mb-2">What's Next?</h4>
        <p className="text-sm text-text-secondary">
          After creating the basic job information, you'll be able to configure the hiring plan with custom stages and assign team members.
        </p>
      </div>

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