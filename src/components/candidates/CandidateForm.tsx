
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { FormField } from '@/components/ui/form-field'
import { useAuth } from '@/contexts/AuthContext'
import { CandidateComments } from './CandidateComments'
import type { Candidate } from '@/hooks/useCandidates'

interface CandidateFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => void
  candidate?: Candidate | null
  jobId: string
  isLoading: boolean
}

export function CandidateForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  candidate, 
  jobId, 
  isLoading 
}: CandidateFormProps) {
  const [formData, setFormData] = useState({
    candidate_name: '',
    location_country: '',
    location_state: '',
    location_city: '',
    salary_amount: '',
    salary_currency: 'USD',
    salary_period: 'annually',
    profile_summary: '',
    notes: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { user } = useAuth()

  useEffect(() => {
    if (candidate) {
      setFormData({
        candidate_name: candidate.candidate_name || '',
        location_country: candidate.location_country || '',
        location_state: candidate.location_state || '',
        location_city: candidate.location_city || '',
        salary_amount: candidate.salary_amount?.toString() || '',
        salary_currency: candidate.salary_currency || 'USD',
        salary_period: candidate.salary_period || 'annually',
        profile_summary: candidate.profile_summary || '',
        notes: candidate.notes || ''
      })
    } else {
      setFormData({
        candidate_name: '',
        location_country: '',
        location_state: '',
        location_city: '',
        salary_amount: '',
        salary_currency: 'USD',
        salary_period: 'annually',
        profile_summary: '',
        notes: ''
      })
    }
    setErrors({})
  }, [candidate, isOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.candidate_name.trim()) {
      newErrors.candidate_name = 'Name is required'
    }
    
    if (formData.salary_amount && isNaN(Number(formData.salary_amount))) {
      newErrors.salary_amount = 'Please enter a valid number'
    }
    
    if (formData.salary_amount && Number(formData.salary_amount) <= 0) {
      newErrors.salary_amount = 'Salary must be greater than 0'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    const submitData = {
      ...formData,
      salary_amount: formData.salary_amount ? Number(formData.salary_amount) : null,
      job_id: jobId
    }
    onSubmit(submitData)
    
    if (!candidate) {
      setFormData({
        candidate_name: '',
        location_country: '',
        location_state: '',
        location_city: '',
        salary_amount: '',
        salary_currency: 'USD',
        salary_period: 'annually',
        profile_summary: '',
        notes: ''
      })
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (!user) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-surface-primary">
        <DialogHeader className="pb-6">
          <DialogTitle className="text-xl font-semibold text-text-primary">
            {candidate ? 'Edit Candidate' : 'Add New Candidate'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Candidate Form */}
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-text-primary">Basic Information</h3>
                
                <FormField 
                  label="Name or Alias" 
                  required 
                  error={errors.candidate_name}
                  htmlFor="candidate_name"
                >
                  <Input
                    id="candidate_name"
                    name="candidate_name"
                    value={formData.candidate_name}
                    onChange={(e) => handleChange('candidate_name', e.target.value)}
                    error={!!errors.candidate_name}
                    placeholder="Enter candidate name or alias"
                    className="h-[44px] w-full"
                  />
                </FormField>
              </div>

              <Separator />

              {/* Location Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-text-primary">Location</h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <FormField 
                    label="Country"
                    htmlFor="location_country"
                  >
                    <Input
                      id="location_country"
                      name="location_country"
                      value={formData.location_country}
                      onChange={(e) => handleChange('location_country', e.target.value)}
                      placeholder="Country"
                      className="h-[44px] w-full"
                    />
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField 
                      label="State/Province"
                      htmlFor="location_state"
                    >
                      <Input
                        id="location_state"
                        name="location_state"
                        value={formData.location_state}
                        onChange={(e) => handleChange('location_state', e.target.value)}
                        placeholder="State/Province"
                        className="h-[44px] w-full"
                      />
                    </FormField>

                    <FormField 
                      label="City"
                      htmlFor="location_city"
                    >
                      <Input
                        id="location_city"
                        name="location_city"
                        value={formData.location_city}
                        onChange={(e) => handleChange('location_city', e.target.value)}
                        placeholder="City"
                        className="h-[44px] w-full"
                      />
                    </FormField>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Salary Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-text-primary">Salary Expectations</h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <FormField 
                    label="Amount"
                    error={errors.salary_amount}
                    htmlFor="salary_amount"
                  >
                    <Input
                      id="salary_amount"
                      name="salary_amount"
                      type="number"
                      value={formData.salary_amount}
                      onChange={(e) => handleChange('salary_amount', e.target.value)}
                      error={!!errors.salary_amount}
                      placeholder="50000"
                      className="h-[44px] w-full"
                    />
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField 
                      label="Currency"
                      htmlFor="salary_currency"
                    >
                      <Select 
                        value={formData.salary_currency} 
                        onValueChange={(value) => handleChange('salary_currency', value)}
                      >
                        <SelectTrigger className="h-[44px] w-full">
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                          <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                          <SelectItem value="MXN">MXN - Mexican Peso</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>

                    <FormField 
                      label="Period"
                      htmlFor="salary_period"
                    >
                      <Select 
                        value={formData.salary_period} 
                        onValueChange={(value) => handleChange('salary_period', value)}
                      >
                        <SelectTrigger className="h-[44px] w-full">
                          <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="annually">Annually</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormField>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Profile & Notes */}
              <div className="space-y-4">
                <FormField 
                  label="Profile Summary" 
                  htmlFor="profile_summary"
                  helpText="Brief overview of candidate's experience and skills"
                >
                  <Textarea
                    id="profile_summary"
                    name="profile_summary"
                    value={formData.profile_summary}
                    onChange={(e) => handleChange('profile_summary', e.target.value)}
                    rows={4}
                    placeholder="Brief summary of candidate's background, experience, and key skills..."
                    className="resize-none w-full"
                  />
                </FormField>

                <FormField 
                  label="Internal Notes" 
                  htmlFor="notes"
                  helpText="Private notes visible only to internal team"
                >
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    rows={3}
                    placeholder="Add any additional internal notes about this candidate..."
                    className="resize-none w-full"
                  />
                </Textarea>
                </FormField>
              </div>

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6">
                <Button 
                  type="submit" 
                  disabled={isLoading} 
                  className="flex-1 h-[44px]"
                >
                  {isLoading ? 'Saving...' : candidate ? 'Update Candidate' : 'Add Candidate'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  className="h-[44px] sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>

          {/* Comments Section - Only show for existing candidates */}
          {candidate && (
            <div className="space-y-4">
              <Separator className="lg:hidden" />
              <div className="bg-surface-secondary rounded-lg p-6">
                <h3 className="text-lg font-medium text-text-primary mb-4">Comments</h3>
                <CandidateComments
                  candidateId={candidate.id}
                  jobId={candidate.job_id}
                  organizationId={user.user_metadata?.organization_id || 'default-org'}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
