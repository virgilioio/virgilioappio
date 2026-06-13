
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HiringTeamTab } from './HiringTeamTab'
import { HiringPlanTab } from './HiringPlanTab'

import { usePermissions } from '@/hooks/usePermissions'
import { JobPostingsTab } from './JobPostingsTab'

interface JobSetupPanelProps {
  jobId: string
  jobTitle: string
  job: any
  onEdit: () => void
  onArchive: () => void
}

export function JobSetupPanel({ jobId, jobTitle, job, onEdit, onArchive }: JobSetupPanelProps) {
  const { isAdmin, isWorkspaceOwner, isPlatformAdmin } = usePermissions()
  // Members who are not admin/WO/PA get read-only access to hiring plan and postings
  const isReadOnly = !(isAdmin || isWorkspaceOwner || isPlatformAdmin)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Setup</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="hiring-team" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="hiring-team">Hiring Team</TabsTrigger>
            <TabsTrigger value="hiring-plan">Hiring Plan</TabsTrigger>
            <TabsTrigger value="job-postings">Job Postings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="hiring-team" className="mt-6">
            <HiringTeamTab jobId={jobId} jobTitle={jobTitle} />
          </TabsContent>
          
          <TabsContent value="hiring-plan" className="mt-6">
            <HiringPlanTab jobId={jobId} readOnly={isReadOnly} />
          </TabsContent>

          <TabsContent value="job-postings" className="mt-6">
            <JobPostingsTab jobId={jobId} jobTitle={jobTitle} readOnly={isReadOnly} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
