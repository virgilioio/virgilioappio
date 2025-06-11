
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
    <Card>
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-md">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-md mb-sm flex-wrap">
              <h1 className="heading-lg font-poppins font-semibold text-primary">{job.title}</h1>
              <Badge variant={getStatusBadgeVariant(job.status)} className="shrink-0">
                {job.status}
              </Badge>
            </div>
            <div className="flex items-center gap-md text-secondary mb-md flex-wrap">
              <div className="flex items-center gap-xs">
                <Building className="h-4 w-4" />
                <span className="text-md">{job.organization_name || 'Organization'}</span>
              </div>
              <div className="flex items-center gap-xs">
                <Briefcase className="h-4 w-4" />
                <span className="text-md">{job.level}</span>
              </div>
            </div>
          </div>
          
          {permissions.canEditJobs && (
            <Button variant="outline" onClick={onEdit} className="min-h-[44px] gap-sm">
              <Edit className="h-5 w-5" />
              Edit Job
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Job Description */}
        {job.description && (
          <div className="mb-lg">
            <h3 className="heading-md font-poppins font-semibold text-primary mb-md flex items-center gap-sm">
              <Briefcase className="h-5 w-5 text-accent" />
              Job Description
            </h3>
            <div className="whitespace-pre-wrap text-md leading-relaxed text-primary bg-surface-secondary p-md rounded-brand">
              {job.description}
            </div>
          </div>
        )}

        {/* Job Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg">
          <div className="flex items-start gap-sm">
            <Building className="h-5 w-5 text-secondary mt-xs shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-secondary mb-xs">Department</p>
              <p className="text-md text-primary break-words">
                {job.department || 'Not specified'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-sm">
            <MapPin className="h-5 w-5 text-secondary mt-xs shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-secondary mb-xs">Location</p>
              <p className="text-md text-primary break-words">
                {job.location || 'Not specified'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-sm">
            <DollarSign className="h-5 w-5 text-secondary mt-xs shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-secondary mb-xs">Salary Range</p>
              <p className="text-md text-primary break-words">
                {formatSalary(job.salary_min, job.salary_max, job.currency)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-sm">
            <Users className="h-5 w-5 text-secondary mt-xs shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-secondary mb-xs">Hiring Team</p>
              <p className="text-md text-primary">
                {job.hiring_team && job.hiring_team.length > 0
                  ? `${job.hiring_team.length} member(s)`
                  : 'No team assigned'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Timeline Information */}
        <div className="mt-lg pt-lg border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-lg">
            <div className="flex items-start gap-sm">
              <Calendar className="h-5 w-5 text-secondary mt-xs shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-secondary mb-xs">Created</p>
                <p className="text-md text-primary">
                  {new Date(job.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-sm">
              <UserCheck className="h-5 w-5 text-secondary mt-xs shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-secondary mb-xs">Last Updated</p>
                <p className="text-md text-primary">
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
