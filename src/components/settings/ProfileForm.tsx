
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
      <div>
        <Label htmlFor="first-name">First Name</Label>
        <Input
          id="first-name"
          value={formData.first_name}
          onChange={(e) => updateFormData('first_name', e.target.value)}
          placeholder="Enter first name"
        />
      </div>

      <div>
        <Label htmlFor="last-name">Last Name</Label>
        <Input
          id="last-name"
          value={formData.last_name}
          onChange={(e) => updateFormData('last_name', e.target.value)}
          placeholder="Enter last name"
        />
      </div>

      <div className="md:col-span-2">
        <Label htmlFor="title">Job Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => updateFormData('title', e.target.value)}
          placeholder="Enter job title"
        />
      </div>

      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => updateFormData('phone', e.target.value)}
          placeholder="Enter phone number"
        />
      </div>

      <div>
        <Label htmlFor="timezone">Timezone</Label>
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
      </div>

      <div className="md:col-span-2">
        <Label htmlFor="linkedin">LinkedIn URL</Label>
        <Input
          id="linkedin"
          value={formData.linkedin_url}
          onChange={(e) => updateFormData('linkedin_url', e.target.value)}
          placeholder="https://linkedin.com/in/yourprofile"
        />
      </div>
    </div>
  )
}
