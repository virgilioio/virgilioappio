
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Job, CreateJobData, UpdateJobData } from '@/hooks/useJobs'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useMembers } from '@/hooks/useMembers'

interface JobFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateJobData | UpdateJobData) => Promise<void>
  job?: Job | null
  isLoading: boolean
}

export function JobForm({ isOpen, onClose, onSubmit, job, isLoading }: JobFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: '',
    level: 'L1 - Specialists' as const,
    location: '',
    salary_min: '',
    salary_max: '',
    currency: 'USD',
    status: 'draft' as const,
    organization_id: '',
    hiring_team: [] as string[]
  })

  const { organizations } = useOrganizations()
  const { members } = useMembers()

  useEffect(() => {
    if (job) {
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
    } else if (organizations.length > 0) {
      setFormData(prev => ({
        ...prev,
        organization_id: organizations[0].id
      }))
    }
  }, [job, organizations])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
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
      hiring_team: formData.hiring_team
    }

    try {
      await onSubmit(submitData)
      onClose()
      // Reset form
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
        organization_id: organizations[0]?.id || '',
        hiring_team: []
      })
    } catch (error) {
      // Error is handled in the hook
    }
  }

  const handleMemberToggle = (memberId: string) => {
    setFormData(prev => ({
      ...prev,
      hiring_team: prev.hiring_team.includes(memberId)
        ? prev.hiring_team.filter(id => id !== memberId)
        : [...prev.hiring_team, memberId]
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? 'Edit Job' : 'Create New Job'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
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
              <Select value={formData.level} onValueChange={(value) => setFormData(prev => ({ ...prev, level: value as any }))}>
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
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}>
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
              <Select value={formData.currency} onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="organization">Organization *</Label>
              <Select value={formData.organization_id} onValueChange={(value) => setFormData(prev => ({ ...prev, organization_id: value }))}>
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
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Job Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the role, responsibilities, and requirements..."
                rows={4}
              />
            </div>

            <div className="col-span-2">
              <Label>Hiring Team</Label>
              <div className="mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No team members available</p>
                ) : (
                  members.map(member => (
                    <div key={member.id} className="flex items-center space-x-2 py-1">
                      <input
                        type="checkbox"
                        id={`member-${member.id}`}
                        checked={formData.hiring_team.includes(member.id)}
                        onChange={() => handleMemberToggle(member.id)}
                        className="rounded"
                      />
                      <label 
                        htmlFor={`member-${member.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {member.user_email || 'Unknown'} ({member.member_role})
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : (job ? 'Update Job' : 'Create Job')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
