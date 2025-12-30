import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSourcingProjects } from '@/hooks/useSourcingProjects'
import { formatDistanceToNow } from 'date-fns'
import { Users, ChevronRight, Search } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export function RecentSourcingProjects() {
  const { data: projects, isLoading } = useSourcingProjects()
  
  // Get top 3 most recent projects
  const recentProjects = projects?.slice(0, 3) ?? []
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-virgilio-purple" />
            Recent Searches
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    )
  }
  
  // Empty state - subtle, no pressure
  if (recentProjects.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            Recent Searches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No searches yet. Your sourcing projects will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4 text-virgilio-purple" />
          Recent Searches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        {recentProjects.map((project) => {
          const candidateCount = project.total_candidates ?? 0
          const updatedAt = project.updated_at 
            ? formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })
            : null
          const title = project.job_spec_data?.job_title || project.name || 'Untitled Search'
          
          return (
            <Link
              key={project.id}
              to={`/find?project=${project.id}`}
              className="flex items-center gap-3 p-3 rounded-lg border border-virgilio-border hover:border-virgilio-purple/40 hover:bg-virgilio-purple/5 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-virgilio-text truncate">
                  {title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {candidateCount} candidate{candidateCount !== 1 ? 's' : ''}
                  </span>
                  {updatedAt && (
                    <>
                      <span>•</span>
                      <span>{updatedAt}</span>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-virgilio-purple transition-colors flex-shrink-0" />
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
