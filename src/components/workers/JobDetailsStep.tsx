import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateWorkerData } from '@/hooks/useWorkers'
import { useWorkers } from '@/hooks/useWorkers'
import { useState, useEffect } from 'react'

interface JobDetailsStepProps {
  data: Partial<CreateWorkerData>
  errors: Record<string, string>
  onUpdate: (data: Partial<CreateWorkerData>) => void
}

export function JobDetailsStep({ data, errors, onUpdate }: JobDetailsStepProps) {
  const { workers } = useWorkers()
  const [availableManagers, setAvailableManagers] = useState<typeof workers>([])

  useEffect(() => {
    // Filter workers who could be managers (active employees/contractors)
    const managers = workers.filter(worker => 
      worker.worker_status === 'active' && 
      worker.organization_id === data.organization_id
    )
    setAvailableManagers(managers)
  }, [workers, data.organization_id])

  const handleChange = (field: keyof CreateWorkerData, value: any) => {
    onUpdate({ [field]: value })
  }

  const seniorityLevels = [
    { value: 'entry', label: 'Entry Level' },
    { value: 'junior', label: 'Junior' },
    { value: 'mid', label: 'Mid Level' },
    { value: 'senior', label: 'Senior' },
    { value: 'lead', label: 'Lead' },
    { value: 'principal', label: 'Principal' },
    { value: 'director', label: 'Director' },
    { value: 'vp', label: 'Vice President' },
    { value: 'c_level', label: 'C-Level' }
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workplace Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="manager_id">Manager</Label>
              <Select
                value={data.manager_id || ''}
                onValueChange={(value) => handleChange('manager_id', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No manager</SelectItem>
                  {availableManagers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name} - {manager.job_title || 'No title'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Worker ID</Label>
              <div className="text-sm text-muted-foreground p-2 bg-muted rounded-md">
                Auto-generated (starts from 1 for each organization)
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="reports">Reports</Label>
              <div className="text-sm text-muted-foreground mb-2">
                Select employees who will report to this worker (optional)
              </div>
              <div className="text-sm text-muted-foreground p-2 bg-muted rounded-md">
                Report assignments can be configured after worker creation
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organizational Structure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              placeholder="e.g., Engineering, Sales, Marketing"
              value={data.department || ''}
              onChange={(e) => handleChange('department', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="job_title">Job Title</Label>
              <Input
                id="job_title"
                placeholder="e.g., Software Engineer, Sales Manager"
                value={data.job_title || ''}
                onChange={(e) => handleChange('job_title', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="seniority_level">Seniority Level</Label>
              <Select
                value={data.seniority_level || ''}
                onValueChange={(value) => handleChange('seniority_level', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select seniority level (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Not specified</SelectItem>
                  {seniorityLevels.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="working_location">Working Location</Label>
              <Input
                id="working_location"
                placeholder="e.g., Remote, New York Office, Hybrid"
                value={data.working_location || ''}
                onChange={(e) => handleChange('working_location', e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="scope_of_work">Scope of Work (Duties and Responsibilities)</Label>
              <Textarea
                id="scope_of_work"
                placeholder="Describe the main duties and responsibilities for this role..."
                value={data.scope_of_work || ''}
                onChange={(e) => handleChange('scope_of_work', e.target.value)}
                rows={4}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}