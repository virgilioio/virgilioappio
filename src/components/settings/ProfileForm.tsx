
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { SearchableSelect } from '@/components/ui/searchable-select'

interface ProfileFormData {
  first_name: string
  last_name: string
  title: string
  phone: string
  linkedin_url: string
  timezone: string
}

interface ProfileFormProps {
  formData: ProfileFormData
  onFormDataChange: (data: ProfileFormData) => void
}

export function ProfileForm({ formData, onFormDataChange }: ProfileFormProps) {
  const timezoneOptions = [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'America/New_York (Eastern Time)' },
    { value: 'America/Chicago', label: 'America/Chicago (Central Time)' },
    { value: 'America/Denver', label: 'America/Denver (Mountain Time)' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (Pacific Time)' },
    { value: 'Europe/London', label: 'Europe/London (GMT)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
    { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney (AEDT)' },
    { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZDT)' }
  ]

  const updateFormData = (field: keyof ProfileFormData, value: string) => {
    onFormDataChange({ ...formData, [field]: value })
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <FormField label="First Name" required htmlFor="first-name">
        <Input
          id="first-name"
          value={formData.first_name}
          onChange={(e) => updateFormData('first_name', e.target.value)}
          placeholder="Enter first name"
        />
      </FormField>

      <FormField label="Last Name" required htmlFor="last-name">
        <Input
          id="last-name"
          value={formData.last_name}
          onChange={(e) => updateFormData('last_name', e.target.value)}
          placeholder="Enter last name"
        />
      </FormField>

      <FormField label="Job Title" htmlFor="title" className="md:col-span-2">
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => updateFormData('title', e.target.value)}
          placeholder="Enter job title"
        />
      </FormField>

      <FormField label="Phone" htmlFor="phone">
        <Input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => updateFormData('phone', e.target.value)}
          placeholder="Enter phone number"
        />
      </FormField>

      <FormField label="Timezone" htmlFor="timezone">
        <SearchableSelect
          options={timezoneOptions}
          value={formData.timezone}
          onValueChange={(value) => updateFormData('timezone', value)}
          placeholder="Select timezone"
          searchPlaceholder="Search timezones..."
          emptyMessage="No timezones found."
        />
      </FormField>

      <FormField 
        label="LinkedIn URL" 
        htmlFor="linkedin" 
        className="md:col-span-2"
        helpText="Your professional LinkedIn profile URL"
      >
        <Input
          id="linkedin"
          type="url"
          value={formData.linkedin_url}
          onChange={(e) => updateFormData('linkedin_url', e.target.value)}
          placeholder="https://linkedin.com/in/yourprofile"
        />
      </FormField>
    </div>
  )
}
