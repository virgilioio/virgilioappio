import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateWorkerData } from '@/hooks/useWorkers'
import { useWorkers } from '@/hooks/useWorkers'
import { useDepartments } from '@/hooks/useDepartments'
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

interface JobDetailsStepProps {
  data: Partial<CreateWorkerData>
  errors: Record<string, string>
  onUpdate: (data: Partial<CreateWorkerData>) => void
}

export function JobDetailsStep({ data, errors, onUpdate }: JobDetailsStepProps) {
  const { workers } = useWorkers()
  const { data: departments = [], isLoading: departmentsLoading } = useDepartments(data.organization_id)
  const [availableManagers, setAvailableManagers] = useState<typeof workers>([])
  const [nextWorkerId, setNextWorkerId] = useState<number>(1)

  useEffect(() => {
    // Filter workers who could be managers (active employees/contractors)
    const managers = workers.filter(worker => 
      worker.worker_status === 'active' && 
      worker.organization_id === data.organization_id
    )
    setAvailableManagers(managers)
  }, [workers, data.organization_id])

  useEffect(() => {
    // Calculate next worker ID for the organization
    const fetchNextWorkerId = async () => {
      if (data.organization_id) {
        try {
          const { data: result, error } = await supabase
            .rpc('generate_worker_id', { org_id: data.organization_id })
          
          if (!error && result) {
            setNextWorkerId(result)
          }
        } catch (err) {
          console.error('Error fetching next worker ID:', err)
          // Fallback: calculate based on existing workers
          const orgWorkers = workers.filter(w => w.organization_id === data.organization_id)
          const maxId = Math.max(0, ...orgWorkers.map(w => w.worker_id || 0))
          setNextWorkerId(maxId + 1)
        }
      }
    }

    fetchNextWorkerId()
  }, [data.organization_id, workers])

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
                value={data.manager_id || 'none'}
                onValueChange={(value) => handleChange('manager_id', value === 'none' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No manager</SelectItem>
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
              <div className="text-sm font-medium p-2 bg-muted/50 rounded-md border">
                {nextWorkerId}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Auto-generated for this organization
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
            <Select
              value={data.department || 'none'}
              onValueChange={(value) => handleChange('department', value === 'none' ? '' : value)}
              disabled={departmentsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={departmentsLoading ? "Loading departments..." : "Select department (optional)"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No department</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.name}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {departments.length === 0 && !departmentsLoading && (
              <div className="text-xs text-muted-foreground mt-1">
                No departments found. Create departments in the People Hub to populate this list.
              </div>
            )}
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
                value={data.seniority_level || 'not_specified'}
                onValueChange={(value) => handleChange('seniority_level', value === 'not_specified' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select seniority level (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_specified">Not specified</SelectItem>
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