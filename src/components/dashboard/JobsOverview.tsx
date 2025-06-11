
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Briefcase, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useJobs } from '@/hooks/useJobs'
import { useJobRequests } from '@/hooks/useJobRequests'
import { PermissionsState } from '@/hooks/usePermissions'

interface JobsOverviewProps {
  permissions: PermissionsState
}

export function JobsOverview({ permissions }: JobsOverviewProps) {
  const { jobs, isLoading: jobsLoading } = useJobs()
  const { jobRequests, isLoading: requestsLoading } = useJobRequests()
  const [activeJobsCount, setActiveJobsCount] = useState(0)
  const [requestsSummary, setRequestsSummary] = useState({
    pending: 0,
    approved: 0,
    rejected: 0
  })

  useEffect(() => {
    if (jobs) {
      const activeCount = jobs.filter(job => job.status === 'open').length
      setActiveJobsCount(activeCount)
    }
  }, [jobs])

  useEffect(() => {
    if (jobRequests && permissions.canViewJobRequests) {
      const summary = jobRequests.reduce((acc, request) => {
        acc[request.status as keyof typeof acc] = (acc[request.status as keyof typeof acc] || 0) + 1
        return acc
      }, { pending: 0, approved: 0, rejected: 0 })
      
      setRequestsSummary(summary)
    }
  }, [jobRequests, permissions.canViewJobRequests])

  const isLoading = jobsLoading || (permissions.canViewJobRequests && requestsLoading)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Jobs Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    )
  }

  const canViewJobs = permissions.canViewJobs || permissions.canCreateJobs || permissions.canRequestJobs

  if (!canViewJobs) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Jobs Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-text-secondary">Active Jobs</p>
            <p className="text-2xl font-semibold text-text-primary">
              {activeJobsCount}
            </p>
          </div>
          
          {permissions.canViewJobRequests && (
            <div className="space-y-1">
              <p className="text-sm text-text-secondary">Job Requests</p>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-xs">
                  {requestsSummary.pending} pending
                </Badge>
                {requestsSummary.approved > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {requestsSummary.approved} approved
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 pt-2 border-t">
          {permissions.canViewJobs && (
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link to="/jobs" className="flex items-center gap-1">
                View Jobs
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}
          
          {permissions.canViewJobRequests && (
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link to="/job-requests" className="flex items-center gap-1">
                View Requests
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
