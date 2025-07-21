import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Worker, CreateWorkerData } from '@/hooks/useWorkers'
import { PhoneInput } from '@/components/ui/phone-input'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useOrganizations } from '@/hooks/useOrganizations'
import { COUNTRIES } from '@/constants/countries'

interface WorkerFormProps {
  worker?: Worker | null
  onSubmit: (data: CreateWorkerData) => void
  onCancel: () => void
}

export function WorkerForm({ worker, onSubmit, onCancel }: WorkerFormProps) {
  const { user } = useAuth()
  const permissions = usePermissions()
  const { organizations } = useOrganizations()
  
  const [formData, setFormData] = useState<CreateWorkerData>({
    organization_id: '',
    full_name: '',
    personal_email: '',
    work_email: '',
    personal_phone: '',
    worker_status: 'pending',
    worker_type: 'full_time',
    job_title: '',
    contract_type: 'permanent',
    contract_status: 'pending',
    country: '',
    currency: 'USD',
    entity: '',
    state_province: '',
    worker_entity_type: 'not_specified',
    start_date: '',
    end_date: '',
    pay_date: '',
    department: '',
    roles_department: ''
  })

  useEffect(() => {
    if (worker) {
      setFormData({
        organization_id: worker.organization_id,
        full_name: worker.full_name,
        personal_email: worker.personal_email || '',
        work_email: worker.work_email || '',
        personal_phone: worker.personal_phone || '',
        worker_status: worker.worker_status,
        worker_type: worker.worker_type,
        job_title: worker.job_title || '',
        contract_type: worker.contract_type || 'permanent',
        contract_status: worker.contract_status || 'pending',
        country: worker.country || '',
        currency: worker.currency || 'USD',
        entity: worker.entity || '',
        state_province: worker.state_province || '',
        worker_entity_type: worker.worker_entity_type || 'not_specified',
        start_date: worker.start_date || '',
        end_date: worker.end_date || '',
        pay_date: worker.pay_date || '',
        department: worker.department || '',
        roles_department: worker.roles_department || ''
      })
    } else {
      // For new workers, we'll determine the organization in the form submission
      // Since useOrganizations doesn't expose userOrganization, we'll handle this in the parent component
    }
  }, [worker, permissions.isPlatformAdmin])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleChange = (field: keyof CreateWorkerData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Organization Selection - Only visible to platform admins */}
        {permissions.isPlatformAdmin && (
          <div className="md:col-span-2">
            <Label htmlFor="organization_id">Organization *</Label>
            <Select
              value={formData.organization_id}
              onValueChange={(value) => handleChange('organization_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Basic Information */}
        <Card className="md:col-span-2">
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
                <Label htmlFor="job_title">Job Title</Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) => handleChange('job_title', e.target.value)}
                />
              </div>

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

              <div>
                <Label htmlFor="personal_phone">Personal Phone</Label>
                <PhoneInput
                  id="personal_phone"
                  value={formData.personal_phone}
                  onChange={(value) => handleChange('personal_phone', value)}
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employment Details */}
        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Employment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div>
                <Label htmlFor="worker_type">Worker Type *</Label>
                <Select
                  value={formData.worker_type}
                  onValueChange={(value) => handleChange('worker_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="consultant">Consultant</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                    <SelectItem value="temporary">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="contract_type">Contract Type</Label>
                <Select
                  value={formData.contract_type}
                  onValueChange={(value) => handleChange('contract_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">Permanent</SelectItem>
                    <SelectItem value="temporary">Temporary</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                    <SelectItem value="fixed_term">Fixed Term</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="contract_status">Contract Status</Label>
                <Select
                  value={formData.contract_status}
                  onValueChange={(value) => handleChange('contract_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleChange('end_date', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location & Administrative */}
        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Location & Administrative</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="country">Country</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => handleChange('country', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.value} value={country.label}>
                        {country.label}
                      </SelectItem>
                    ))}
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
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => handleChange('currency', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="AUD">AUD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="worker_entity_type">Worker Entity Type</Label>
                <Select
                  value={formData.worker_entity_type}
                  onValueChange={(value) => handleChange('worker_entity_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_specified">Not Specified</SelectItem>
                    <SelectItem value="business_entity">Business Entity</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="entity">Entity</Label>
                <Input
                  id="entity"
                  value={formData.entity}
                  onChange={(e) => handleChange('entity', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="pay_date">Pay Date</Label>
                <Input
                  id="pay_date"
                  type="date"
                  value={formData.pay_date}
                  onChange={(e) => handleChange('pay_date', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-4 pt-6 border-t">
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