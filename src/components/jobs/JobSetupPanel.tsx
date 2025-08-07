import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HiringTeamTab } from './HiringTeamTab'
import { HiringPlanTab } from './HiringPlanTab'

interface JobSetupPanelProps {
  jobId: string
  jobTitle: string
}

export function JobSetupPanel({ jobId, jobTitle }: JobSetupPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Setup</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="hiring-team" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="hiring-team">Hiring Team</TabsTrigger>
            <TabsTrigger value="hiring-plan">Hiring Plan</TabsTrigger>
          </TabsList>
          
          <TabsContent value="hiring-team" className="mt-6">
            <HiringTeamTab jobId={jobId} jobTitle={jobTitle} />
          </TabsContent>
          
          <TabsContent value="hiring-plan" className="mt-6">
            <HiringPlanTab jobId={jobId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}