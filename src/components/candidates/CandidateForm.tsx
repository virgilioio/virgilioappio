
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
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
  }, [candidate, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
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
          <div className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="candidate_name">Name *</Label>
                <Input
                  id="candidate_name"
                  name="candidate_name"
                  value={formData.candidate_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <Label htmlFor="candidate_email">Email *</Label>
                <Input
                  id="candidate_email"
                  name="candidate_email"
                  type="email"
                  value={formData.candidate_email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <Label htmlFor="resume_url">Resume URL</Label>
                <Input
                  id="resume_url"
                  name="resume_url"
                  type="url"
                  value={formData.resume_url}
                  onChange={handleChange}
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Add any additional notes about this candidate..."
                />
              </div>

              <div className="flex gap-3 pt-4">
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
            <div className="space-y-4">
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
