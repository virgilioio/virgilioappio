
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HiringTeamTab } from './HiringTeamTab'
import { HiringPlanTab } from './HiringPlanTab'
import { JobOverviewTab } from './JobOverviewTab'
import { usePermissions } from '@/hooks/usePermissions'
import { JobPostingsTab } from './JobPostingsTab'

interface JobSetupPanelProps {
  jobId: string
  jobTitle: string
  job: any
  onEdit: () => void
}

export function JobSetupPanel({ jobId, jobTitle, job, onEdit }: JobSetupPanelProps) {
  const { isClient } = usePermissions()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Setup</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="hiring-team">Hiring Team</TabsTrigger>
            <TabsTrigger value="hiring-plan">Hiring Plan</TabsTrigger>
            <TabsTrigger value="job-postings">Job Postings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-6">
            <JobOverviewTab 
              job={{
                ...job,
                hiring_team: (job.hiring_team as any[]) || []
              }} 
              onEdit={onEdit}
            />
          </TabsContent>
          
          <TabsContent value="hiring-team" className="mt-6">
            <HiringTeamTab jobId={jobId} jobTitle={jobTitle} />
          </TabsContent>
          
          <TabsContent value="hiring-plan" className="mt-6">
            <HiringPlanTab jobId={jobId} readOnly={isClient} />
          </TabsContent>

          <TabsContent value="job-postings" className="mt-6">
            <JobPostingsTab jobId={jobId} jobTitle={jobTitle} readOnly={isClient} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
