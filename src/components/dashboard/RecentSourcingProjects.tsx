import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSourcingProjects } from '@/hooks/useSourcingProjects'
import { formatDistanceToNow } from 'date-fns'
import { Users, ChevronRight, Search } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import gioFacePurple from '@/assets/gio-face-purple.png'

export function RecentSourcingProjects() {
  const { data: projects, isLoading } = useSourcingProjects()
  
  // Get top 3 most recent projects
  const recentProjects = projects?.slice(0, 3) ?? []
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-virgilio-purple" />
            Recent Searches
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }
  
  // Empty state - subtle, no pressure
  if (recentProjects.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            Recent Searches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <img src={gioFacePurple} alt="No searches" className="w-16 h-16 mb-4" />
            <h3 className="text-lg font-poppins font-bold text-virgilio-text tracking-page-title">
              No searches yet<span className="text-purple-period">.</span>
            </h3>
            <p className="text-sm text-virgilio-muted mt-2">Your sourcing projects will appear here</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
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
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-all group"
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm text-foreground truncate block">
                  {title}
                </span>
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
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
