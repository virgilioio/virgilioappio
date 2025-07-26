import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Worker, UpdateWorkerData } from '@/hooks/useWorkers'
import { PhoneInput } from '@/components/ui/phone-input'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useCountries } from '@/hooks/useCountries'

interface WorkerFormProps {
  worker?: Worker | null
  onSubmit: (data: UpdateWorkerData) => void
  onCancel: () => void
  prefilledData?: Partial<UpdateWorkerData>
}

export function WorkerForm({ worker, onSubmit, onCancel, prefilledData }: WorkerFormProps) {
  const { user } = useAuth()
  const permissions = usePermissions()
  const { organizations } = useOrganizations()
  const { countries, isLoading: countriesLoading } = useCountries()
  
  const [formData, setFormData] = useState<UpdateWorkerData>({
    full_name: '',
    legal_first_name: '',
    legal_last_name: '',
    date_of_birth: '',
    citizenship: '',
    personal_email: '',
    work_email: '',
    personal_phone: '',
    worker_status: 'pending',
    country: '',
    state_province: '',
    worker_entity_type: 'individual',
    ...prefilledData
  })

  // State for date of birth components
  const [dateComponents, setDateComponents] = useState({
    day: '',
    month: '',
    year: ''
  })

  useEffect(() => {
    if (worker) {
      setFormData({
        full_name: worker.full_name,
        legal_first_name: worker.legal_first_name || '',
        legal_last_name: worker.legal_last_name || '',
        date_of_birth: worker.date_of_birth || '',
        citizenship: worker.citizenship || '',
        personal_email: worker.personal_email || '',
        work_email: worker.work_email || '',
        personal_phone: worker.personal_phone || '',
        worker_status: worker.worker_status,
        country: worker.country || '',
        state_province: worker.state_province || '',
        worker_entity_type: worker.worker_entity_type || 'individual'
      })

      // Initialize date components if date_of_birth exists
      if (worker.date_of_birth) {
        const [year, month, day] = worker.date_of_birth.split('-')
        setDateComponents({ day, month, year })
      }
    }
  }, [worker])

  // Update date_of_birth when date components change
  useEffect(() => {
    if (dateComponents.day && dateComponents.month && dateComponents.year) {
      const dateString = `${dateComponents.year}-${dateComponents.month.padStart(2, '0')}-${dateComponents.day.padStart(2, '0')}`
      setFormData(prev => ({ ...prev, date_of_birth: dateString }))
    }
  }, [dateComponents])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleChange = (field: keyof UpdateWorkerData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleDateChange = (component: 'day' | 'month' | 'year', value: string) => {
    setDateComponents(prev => ({
      ...prev,
      [component]: value
    }))
  }

  // Generate arrays for date dropdowns
  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ]
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {/* Basic Information */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="worker_status">Worker Status</Label>
                <Select
                  value={formData.worker_status}
                  onValueChange={(value) => handleChange('worker_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legal Information */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Legal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="legal_first_name">Legal First Name</Label>
                <Input
                  id="legal_first_name"
                  value={formData.legal_first_name}
                  onChange={(e) => handleChange('legal_first_name', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="legal_last_name">Legal Last Name</Label>
                <Input
                  id="legal_last_name"
                  value={formData.legal_last_name}
                  onChange={(e) => handleChange('legal_last_name', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="citizenship">Citizenship</Label>
                <Select
                  value={formData.citizenship || ''}
                  onValueChange={(value) => handleChange('citizenship', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select citizenship" />
                  </SelectTrigger>
                  <SelectContent>
                    {countriesLoading ? (
                      <SelectItem value="loading" disabled>Loading countries...</SelectItem>
                    ) : (
                      countries.map((country) => (
                        <SelectItem key={country.id} value={country.name}>
                          {country.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Date of Birth</Label>
                <div className="flex gap-2">
                  <Select
                    value={dateComponents.day}
                    onValueChange={(value) => handleDateChange('day', value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      {days.map((day) => (
                        <SelectItem key={day} value={day.toString().padStart(2, '0')}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select
                    value={dateComponents.month}
                    onValueChange={(value) => handleDateChange('month', value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      {months.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select
                    value={dateComponents.year}
                    onValueChange={(value) => handleDateChange('year', value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="country">Country of Residence</Label>
                <Select
                  value={formData.country || ''}
                  onValueChange={(value) => handleChange('country', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countriesLoading ? (
                      <SelectItem value="loading" disabled>Loading countries...</SelectItem>
                    ) : (
                      countries.map((country) => (
                        <SelectItem key={country.id} value={country.name}>
                          {country.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="state_province">State/Province</Label>
                <Input
                  id="state_province"
                  value={formData.state_province}
                  onChange={(e) => handleChange('state_province', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="worker_entity_type">Entity Type</Label>
                <Select
                  value={formData.worker_entity_type}
                  onValueChange={(value) => handleChange('worker_entity_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="business_entity">Business Entity</SelectItem>
                    <SelectItem value="not_specified">Not Specified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="personal_email">Personal Email</Label>
                <Input
                  id="personal_email"
                  type="email"
                  value={formData.personal_email}
                  onChange={(e) => handleChange('personal_email', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="work_email">Work Email</Label>
                <Input
                  id="work_email"
                  type="email"
                  value={formData.work_email}
                  onChange={(e) => handleChange('work_email', e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="personal_phone">Personal Phone</Label>
                <PhoneInput
                  id="personal_phone"
                  value={formData.personal_phone}
                  onChange={(value) => handleChange('personal_phone', value)}
                  placeholder="Enter phone number"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {worker ? 'Update Worker' : 'Create Worker'}
        </Button>
      </div>
    </form>
  )
}