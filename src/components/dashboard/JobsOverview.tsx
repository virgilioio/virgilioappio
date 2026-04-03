import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Briefcase, ExternalLink, MapPin, Building, ChevronRight, Users, Clock } from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import { MetricCardGroup } from '@/components/ui/metric-card-group'
import { Link } from 'react-router-dom'
import { useJobs } from '@/hooks/useJobs'
import { PermissionsState } from '@/hooks/usePermissions'
import { WidgetSize } from '@/hooks/useDashboardLayout'

interface JobsOverviewProps {
  permissions: PermissionsState
  size?: WidgetSize
}

const getJobStatusVariant = (status: string) => {
  switch (status) {
    case 'open': return 'job-open' as const
    case 'draft': return 'job-draft' as const
    case 'closed': return 'job-closed' as const
    case 'archived': return 'job-archived' as const
    default: return 'job-draft' as const
  }
}

export function JobsOverview({ permissions, size = 'medium' }: JobsOverviewProps) {
  const { jobs, isLoading: jobsLoading } = useJobs()
  const [activeJobsCount, setActiveJobsCount] = useState(0)

  useEffect(() => {
    if (jobs) {
      const activeCount = jobs.filter(job => job.status === 'open').length
      setActiveJobsCount(activeCount)
    }
  }, [jobs])

  const isLoading = jobsLoading
  const canViewJobs = permissions.canViewJobs || permissions.canCreateJobs
  if (!canViewJobs) return null

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            Jobs Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const openJobs = jobs?.filter(job => job.status === 'open') ?? []
  const draftJobs = jobs?.filter(job => job.status === 'draft') ?? []
  const closedJobs = jobs?.filter(job => job.status === 'closed') ?? []

  // ── Small: compact summary ──
  if (size === 'small') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            Jobs Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-2xl font-semibold text-foreground">{activeJobsCount}</p>
            <p className="text-xs text-muted-foreground">Active jobs</p>
          </div>
          <Link to="/jobs" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="w-full justify-center gap-1.5">
              View All Jobs
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  // ── Medium: operational context ──
  if (size === 'medium') {
    const recentJobs = openJobs.slice(0, 4)
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Jobs Overview
            </CardTitle>
            <Link to="/jobs" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                View All
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-lg font-semibold text-foreground">{openJobs.length}</p>
              <p className="text-[11px] text-muted-foreground">Open</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-lg font-semibold text-foreground">{draftJobs.length}</p>
              <p className="text-[11px] text-muted-foreground">Draft</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-lg font-semibold text-foreground">{closedJobs.length}</p>
              <p className="text-[11px] text-muted-foreground">Closed</p>
            </div>
          </div>

          {/* Job list */}
          {recentJobs.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Open</p>
              {recentJobs.map(job => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border hover:bg-accent hover:border-accent-foreground/20 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">{job.title}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {job.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />{job.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── Large: richest view ──
  const recentJobs = openJobs.slice(0, 6)
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            Jobs Overview
          </CardTitle>
          <Link to="/jobs" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
              View All Jobs
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-lg font-semibold text-foreground">{openJobs.length}</p>
            <p className="text-[11px] text-muted-foreground">Open</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-lg font-semibold text-foreground">{draftJobs.length}</p>
            <p className="text-[11px] text-muted-foreground">Draft</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-lg font-semibold text-foreground">{closedJobs.length}</p>
            <p className="text-[11px] text-muted-foreground">Closed</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-lg font-semibold text-foreground">{jobs?.length ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Total</p>
          </div>
        </div>

        {/* Detailed job table */}
        {recentJobs.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Positions</p>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 py-2 bg-muted/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
                <span>Position</span>
                <span>Location</span>
                <span>Dept</span>
              </div>
              {recentJobs.map((job, idx) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-3 py-2.5 hover:bg-accent transition-colors group ${idx < recentJobs.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">{job.title}</span>
                    <Badge variant={getJobStatusVariant(job.status)} className="shrink-0 text-[10px]">
                      {job.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {job.location || '—'}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                    {job.department || '—'}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {permissions.canCreateJobs && (
          <div className="flex gap-2 pt-1">
            <Link to="/jobs/new" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="text-xs">
                Create New Job
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
