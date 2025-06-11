
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Building, Briefcase, MapPin, DollarSign, Users, Calendar, UserCheck } from 'lucide-react'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { usePermissions } from '@/hooks/usePermissions'
import type { Job } from '@/hooks/useJobs'

interface JobOverviewTabProps {
  job: Job
  onEdit: () => void
}

export function JobOverviewTab({ job, onEdit }: JobOverviewTabProps) {
  const permissions = usePermissions()

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'open':
        return 'default'
      case 'draft':
        return 'secondary'
      case 'closed':
        return 'destructive'
      case 'archived':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const formatSalary = (min: number | null, max: number | null, currency: string | null) => {
    if (!min && !max) return 'Not specified'
    
    const curr = currency || 'USD'
    if (min && max) {
      return `${curr} ${min.toLocaleString()} - ${max.toLocaleString()}`
    }
    if (min) {
      return `${curr} ${min.toLocaleString()}+`
    }
    if (max) {
      return `Up to ${curr} ${max.toLocaleString()}`
    }
    return 'Not specified'
  }

  return (
    <Card hover>
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-poppins font-semibold text-text-primary">{job.title}</h1>
              <Badge variant={getStatusBadgeVariant(job.status)} className="shrink-0">
                {job.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-text-secondary mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                <span className="text-md">{job.organization_name || 'Organization'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                <span className="text-md">{job.level}</span>
              </div>
            </div>
          </div>
          
          {permissions.canEditJobs && (
            <Button variant="outline" onClick={onEdit} className="min-h-[44px] gap-2">
              <Edit className="h-5 w-5" />
              Edit Job
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Job Description */}
        {job.description && (
          <div className="mb-8">
            <h3 className="text-lg font-poppins font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-accent" />
              Job Description
            </h3>
            <div className="whitespace-pre-wrap text-md leading-relaxed text-text-primary bg-surface-secondary p-4 rounded-brand">
              {job.description}
            </div>
          </div>
        )}

        {/* Job Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <Building className="h-5 w-5 text-text-secondary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-secondary mb-1">Department</p>
              <p className="text-md text-text-primary break-words">
                {job.department || 'Not specified'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-text-secondary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-secondary mb-1">Location</p>
              <p className="text-md text-text-primary break-words">
                {job.location || 'Not specified'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-text-secondary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-secondary mb-1">Salary Range</p>
              <p className="text-md text-text-primary break-words">
                {formatSalary(job.salary_min, job.salary_max, job.currency)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-text-secondary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-secondary mb-1">Hiring Team</p>
              <p className="text-md text-text-primary">
                {job.hiring_team && job.hiring_team.length > 0
                  ? `${job.hiring_team.length} member(s)`
                  : 'No team assigned'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Timeline Information */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-text-secondary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-secondary mb-1">Created</p>
                <p className="text-md text-text-primary">
                  {new Date(job.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <UserCheck className="h-5 w-5 text-text-secondary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-secondary mb-1">Last Updated</p>
                <p className="text-md text-text-primary">
                  {new Date(job.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
