
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
    candidate_email: '',
    notes: '',
    resume_url: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { user } = useAuth()

  useEffect(() => {
    if (candidate) {
      setFormData({
        candidate_name: candidate.candidate_name || '',
        candidate_email: candidate.candidate_email || '',
        notes: candidate.notes || '',
        resume_url: candidate.resume_url || ''
      })
    } else {
      setFormData({
        candidate_name: '',
        candidate_email: '',
        notes: '',
        resume_url: ''
      })
    }
    setErrors({})
  }, [candidate, isOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.candidate_name.trim()) {
      newErrors.candidate_name = 'Name is required'
    }
    
    if (!formData.candidate_email.trim()) {
      newErrors.candidate_email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.candidate_email)) {
      newErrors.candidate_email = 'Please enter a valid email address'
    }
    
    if (formData.resume_url && !/^https?:\/\/.+/.test(formData.resume_url)) {
      newErrors.resume_url = 'Please enter a valid URL'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    const submitData = {
      ...formData,
      job_id: jobId
    }
    onSubmit(submitData)
    
    if (!candidate) {
      setFormData({
        candidate_name: '',
        candidate_email: '',
        notes: '',
        resume_url: ''
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {candidate ? 'Edit Candidate' : 'Add New Candidate'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Candidate Form */}
          <div className="space-y-md">
            <form onSubmit={handleSubmit} className="space-y-md">
              <FormField 
                label="Name" 
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
                  placeholder="Enter candidate name"
                />
              </FormField>

              <FormField 
                label="Email" 
                required 
                error={errors.candidate_email}
                htmlFor="candidate_email"
              >
                <Input
                  id="candidate_email"
                  name="candidate_email"
                  type="email"
                  value={formData.candidate_email}
                  onChange={(e) => handleChange('candidate_email', e.target.value)}
                  error={!!errors.candidate_email}
                  placeholder="Enter email address"
                />
              </FormField>

              <FormField 
                label="Resume URL" 
                error={errors.resume_url}
                helpText="Link to candidate's resume or portfolio"
                htmlFor="resume_url"
              >
                <Input
                  id="resume_url"
                  name="resume_url"
                  type="url"
                  value={formData.resume_url}
                  onChange={(e) => handleChange('resume_url', e.target.value)}
                  error={!!errors.resume_url}
                  placeholder="https://..."
                />
              </FormField>

              <FormField 
                label="Notes" 
                htmlFor="notes"
                helpText="Additional information about this candidate"
              >
                <Textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  rows={4}
                  placeholder="Add any additional notes about this candidate..."
                />
              </FormField>

              <div className="flex gap-3 pt-md">
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? 'Saving...' : candidate ? 'Update Candidate' : 'Add Candidate'}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>

          {/* Comments Section - Only show for existing candidates */}
          {candidate && (
            <div className="space-y-md">
              <Separator className="lg:hidden" />
              <CandidateComments
                candidateId={candidate.id}
                jobId={candidate.job_id}
                organizationId={user.user_metadata?.organization_id || 'default-org'}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
