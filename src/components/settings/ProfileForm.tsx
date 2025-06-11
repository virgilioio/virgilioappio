
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'

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
  const timezones = [
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
    'Australia/Sydney', 'Pacific/Auckland'
  ]

  const updateFormData = (field: keyof ProfileFormData, value: string) => {
    onFormDataChange({ ...formData, [field]: value })
  }

  return (
    <div className="grid gap-md md:grid-cols-2">
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
        <Select 
          value={formData.timezone} 
          onValueChange={(value) => updateFormData('timezone', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {timezones.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
