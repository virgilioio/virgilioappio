
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Phone, MapPin, Building, Calendar, DollarSign, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkers } from '@/hooks/useWorkers'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function WorkerProfile() {
  const { workerId } = useParams()
  const navigate = useNavigate()
  const { workers, isLoading } = useWorkers()

  console.log('WorkerProfile - workerId:', workerId)
  console.log('WorkerProfile - workers:', workers)

  const worker = workers.find(w => w.id === workerId)

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
        </div>
      </div>
    )
  }

  if (!worker) {
    return (
      <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Worker Not Found</h1>
          <p className="text-muted-foreground mb-4">Worker ID: {workerId}</p>
          <Button onClick={() => navigate('/people-hub/people')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to People
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Tabs */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Worker Profile</TabsTrigger>
          <TabsTrigger value="contract">Contract</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <WorkerProfileContent worker={worker} />
        </TabsContent>

        <TabsContent value="contract" className="mt-6">
          <ContractContent worker={worker} />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <DocumentsContent worker={worker} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Worker Profile Tab Content
function WorkerProfileContent({ worker }: { worker: any }) {
  return (
    <div className="space-y-6">
      {/* Worker Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {worker.full_name}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-md">
          {worker.full_name} • {worker.job_title || 'No title'} • {worker.organization_name}
        </p>
      </div>

      {/* Main Content - Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Main Cards */}
        <div className="space-y-4">
          {/* General Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                General Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                <p className="text-sm">
                  <span className="font-medium text-muted-foreground">Worker ID:</span> {worker.worker_id || 'Not assigned'}
                </p>
                <p className="text-sm flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span className="font-medium text-muted-foreground">Personal Email:</span> {worker.personal_email || 'Not provided'}
                </p>
                <p className="text-sm flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span className="font-medium text-muted-foreground">Work Email:</span> {worker.work_email || 'Not provided'}
                </p>
                <p className="text-sm flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span className="font-medium text-muted-foreground">Personal Phone:</span> {worker.personal_phone || 'Not provided'}
                </p>
                <p className="text-sm flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span className="font-medium text-muted-foreground">Country:</span> {worker.country || 'Not specified'}
                </p>
                <p className="text-sm">
                  <span className="font-medium text-muted-foreground">State/Province:</span> {worker.state_province || 'Not specified'}
                </p>
                <p className="text-sm flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span className="font-medium text-muted-foreground">Birthday:</span> Not available
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Organization Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Organization Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                <p className="text-sm">
                  <span className="font-medium text-muted-foreground">Department:</span> {worker.department || 'Not specified'}
                </p>
                <p className="text-sm">
                  <span className="font-medium text-muted-foreground">Job Title:</span> {worker.job_title || 'Not specified'}
                </p>
                <p className="text-sm">
                  <span className="font-medium text-muted-foreground">Manager Name:</span> {worker.manager_name || 'Not assigned'}
                </p>
                <p className="text-sm">
                  <span className="font-medium text-muted-foreground">Reports:</span> {worker.reports && worker.reports.length > 0 
                    ? `${worker.reports.length} direct report(s)`
                    : 'No direct reports'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Empty for now */}
        <div className="space-y-4">
          {/* This column is reserved for future content */}
        </div>
      </div>
    </div>
  )
}

// Contract Tab Content
function ContractContent({ worker }: { worker: any }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Contract Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Contract management features coming soon...</p>
        </CardContent>
      </Card>
    </div>
  )
}

// Documents Tab Content
function DocumentsContent({ worker }: { worker: any }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Document management features coming soon...</p>
        </CardContent>
      </Card>
    </div>
  )
}
