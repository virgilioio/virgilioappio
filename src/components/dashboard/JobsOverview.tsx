
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Briefcase, ExternalLink, MapPin, Building } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useJobs } from '@/hooks/useJobs'

import { PermissionsState } from '@/hooks/usePermissions'

interface JobsOverviewProps {
  permissions: PermissionsState
}

export function JobsOverview({ permissions }: JobsOverviewProps) {
  const { jobs, isLoading: jobsLoading } = useJobs()
  const [activeJobsCount, setActiveJobsCount] = useState(0)

  useEffect(() => {
    if (jobs) {
      const activeCount = jobs.filter(job => job.status === 'open').length
      setActiveJobsCount(activeCount)
      console.log('Jobs overview - Active jobs count:', activeCount, 'Total jobs:', jobs.length)
    }
  }, [jobs])

  const isLoading = jobsLoading

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

  const canViewJobs = permissions.canViewJobs || permissions.canCreateJobs

  if (!canViewJobs) {
    return null
  }

  // Get the 5 most recent jobs
  const recentJobs = jobs?.slice(0, 5) || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'closed':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'archived':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
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
        <div className="space-y-1">
          <p className="text-sm text-text-secondary">Active Jobs</p>
          <p className="text-2xl font-semibold text-text-primary">
            {activeJobsCount}
          </p>
        </div>

        {/* Recent Jobs List */}
        {recentJobs.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm font-medium text-text-primary">Recent Jobs</p>
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <Link 
                  key={job.id} 
                  to={`/jobs/${job.id}`}
                  className="block p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-foreground truncate">
                          {job.title}
                        </h4>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getStatusColor(job.status)}`}
                        >
                          {job.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {job.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{job.location}</span>
                          </div>
                        )}
                        {job.department && (
                          <div className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            <span className="truncate">{job.department}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex gap-2 pt-2 border-t border-border">
          {permissions.canViewJobs && (
            <Link to="/jobs">
              <Button variant="ghost" size="sm">
                View All Jobs
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
