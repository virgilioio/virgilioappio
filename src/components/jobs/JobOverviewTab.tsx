
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SafeHtml } from '@/components/ui/safe-html'
import { MetricCard } from '@/components/ui/metric-card'
import { Edit, Building, Briefcase, MapPin, DollarSign, Users, Calendar, UserCheck, User, Archive, Clock, FileText } from 'lucide-react'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { usePermissions } from '@/hooks/usePermissions'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Job } from '@/hooks/useJobs'
import { getSkillColor } from '@/utils/skillColors'

interface JobOverviewTabProps {
  job: Job
  onEdit: () => void
  onArchive: () => void
}

export function JobOverviewTab({ job, onEdit, onArchive }: JobOverviewTabProps) {
  const permissions = usePermissions()

  // Fetch creator information
  const { data: creator } = useQuery({
    queryKey: ['job-creator', job.created_by],
    queryFn: async () => {
      if (!job.created_by) return null
      
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('user_id', job.created_by)
        .single()

      if (error) {
        console.error('Error fetching creator:', error)
        return null
      }

      return data
    },
    enabled: !!job.created_by,
  })

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

  const formatCreatorName = () => {
    if (!creator) return 'Unknown'
    
    const fullName = [creator.first_name, creator.last_name].filter(Boolean).join(' ')
    return fullName || creator.email || 'Unknown'
  }

  // Process skills data
  const aiSkills = Array.isArray((job as any)?.auto_generated_skills)
    ? ((job as any).auto_generated_skills as any[]).map((s) => typeof s === 'string' ? s : s?.name).filter(Boolean)
    : []
  const skills = job.skills && job.skills.length > 0 ? job.skills : aiSkills

  return (
    <div className="space-y-6">
      {/* Header - Outside Cards */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-poppins font-semibold text-virgilio-text mb-3">
            {job.title}<span className="text-virgilio-purple">.</span>
          </h1>
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <Badge variant={getStatusBadgeVariant(job.status)} className="font-medium">
              {job.status}
            </Badge>
            <span className="text-virgilio-muted">·</span>
            <div className="flex items-center gap-2 text-virgilio-muted">
              <Building className="h-4 w-4" />
              <span>{job.organization_name || 'Organization'}</span>
            </div>
          </div>
        </div>
        
        {permissions.canEditJobs && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={onEdit} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit Job
            </Button>
            {job.status !== 'archived' && (
              <Button variant="outline" onClick={onArchive} className="gap-2">
                <Archive className="h-4 w-4" />
                Archive Job
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Quick Stats - MetricCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Department"
          value={job.organization_name || job.department || 'Not specified'}
          icon={<Building />}
          tooltip="Job department"
        />
        
        <MetricCard
          title="Location"
          value={job.location || 'Not specified'}
          icon={<MapPin />}
          tooltip="Job location"
        />
        
        <MetricCard
          title="Salary Range"
          value={formatSalary(job.salary_min, job.salary_max, job.currency)}
          icon={<DollarSign />}
          tooltip="Salary range for this position"
        />
        
        <MetricCard
          title="Hiring Team"
          value={job.hiring_team?.length || 0}
          icon={<Users />}
          tooltip="Number of team members"
        />
      </div>

      {/* Required Skills */}
      {skills && skills.length > 0 && (
        <Card className="shadow-calendly border-virgilio-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-virgilio-text font-poppins">
              <Briefcase className="h-5 w-5 text-virgilio-purple" />
              Required Skills<span className="text-virgilio-purple">.</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, idx) => (
                <Badge 
                  key={`${skill}-${idx}`} 
                  variant={getSkillColor(skill)} 
                  className="text-sm px-3 py-1"
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Description */}
      {job.description && (
        <Card className="shadow-calendly border-virgilio-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-virgilio-text font-poppins">
              <FileText className="h-5 w-5 text-virgilio-purple" />
              Job Description<span className="text-virgilio-purple">.</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SafeHtml
              content={job.description}
              className="prose prose-sm max-w-none text-virgilio-text
                [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3
                [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3
                [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0
                [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:text-virgilio-text
                [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:text-virgilio-text
                [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:text-virgilio-text
                [&_strong]:font-semibold [&_strong]:text-virgilio-text
                [&_a]:text-virgilio-purple [&_a]:underline hover:[&_a]:text-virgilio-purple/80
                [&_li]:text-virgilio-text [&_li]:my-1"
            />
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card className="shadow-calendly border-virgilio-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-virgilio-text font-poppins">
            <Clock className="h-5 w-5 text-virgilio-purple" />
            Timeline<span className="text-virgilio-purple">.</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2 text-virgilio-muted">
              <User className="h-4 w-4" />
              <span>Created by <strong className="text-virgilio-text font-semibold">{formatCreatorName()}</strong></span>
            </div>
            <span className="text-virgilio-muted">·</span>
            <div className="flex items-center gap-2 text-virgilio-muted">
              <Calendar className="h-4 w-4" />
              <span>{new Date(job.created_at).toLocaleDateString()}</span>
            </div>
            <span className="text-virgilio-muted">·</span>
            <div className="flex items-center gap-2 text-virgilio-muted">
              <UserCheck className="h-4 w-4" />
              <span>Updated {new Date(job.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
