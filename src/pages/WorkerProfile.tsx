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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'pending':
        return 'secondary'
      case 'inactive':
      case 'terminated':
        return 'destructive'
      case 'on_leave':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'employee':
        return 'default'
      case 'contractor':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const formatWorkerType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatWorkerStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
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
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'pending':
        return 'secondary'
      case 'inactive':
      case 'terminated':
        return 'destructive'
      case 'on_leave':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'employee':
        return 'default'
      case 'contractor':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const formatWorkerType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatWorkerStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Personal Information */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Legal Name</label>
                <p className="text-sm">{worker.legal_first_name} {worker.legal_last_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Citizenship</label>
                <p className="text-sm">{worker.citizenship || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Personal Email</label>
                <p className="text-sm">{worker.personal_email || 'Not provided'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Work Email</label>
                <p className="text-sm">{worker.work_email || 'Not provided'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Personal Phone</label>
                <p className="text-sm">{worker.personal_phone || 'Not provided'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Country</label>
                <p className="text-sm">{worker.country || 'Not specified'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Employment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Worker ID</label>
                <p className="text-sm">{worker.worker_id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Contract Type</label>
                <p className="text-sm">{worker.contract_type}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Employment Term</label>
                <p className="text-sm">{worker.employment_term || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Seniority Level</label>
                <p className="text-sm">{worker.seniority_level || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                <p className="text-sm">
                  {worker.start_date ? new Date(worker.start_date).toLocaleDateString() : 'Not set'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">End Date</label>
                <p className="text-sm">
                  {worker.end_date ? new Date(worker.end_date).toLocaleDateString() : 'Open-ended'}
                </p>
              </div>
            </div>
            
            {worker.scope_of_work && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Scope of Work</label>
                <p className="text-sm mt-1">{worker.scope_of_work}</p>
              </div>
            )}
            
            {worker.working_location && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Working Location</label>
                <p className="text-sm mt-1">{worker.working_location}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Payment Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Currency</label>
              <p className="text-sm">{worker.currency || 'Not specified'}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Payment Frequency</label>
              <p className="text-sm">
                {worker.payment_frequency === 'bi_monthly' && 'Bi-monthly (15th & Last)'}
                {worker.payment_frequency === 'monthly' && 'Monthly (Last of Month)'}
                {worker.payment_frequency === 'custom' && `Custom: ${worker.custom_pay_dates?.join(', ') || 'Not set'}`}
                {!worker.payment_frequency && 'Not set'}
              </p>
            </div>

            {worker.worker_type === 'contractor' && (
              <>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Payment Type</label>
                  <p className="text-sm">{worker.contractor_payment_type || 'Not specified'}</p>
                </div>
                
                {worker.contractor_payment_type === 'hourly_rate' && worker.hourly_rate && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Hourly Rate</label>
                    <p className="text-sm">{worker.currency} {worker.hourly_rate}</p>
                  </div>
                )}
                
                {worker.contractor_payment_type === 'fixed_rate' && worker.monthly_fixed_amount !== null && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Monthly Fixed Amount</label>
                    <p className="text-sm">{worker.currency} {worker.monthly_fixed_amount}</p>
                  </div>
                )}
              </>
            )}

            {worker.worker_type === 'employee' && worker.base_salary && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Base Salary</label>
                <p className="text-sm">{worker.currency} {worker.base_salary}</p>
              </div>
            )}
            
            {worker.next_payment_date && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Next Payment</label>
                <p className="text-sm">{new Date(worker.next_payment_date).toLocaleDateString()}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Organization Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Organization</label>
              <p className="text-sm">{worker.organization_name}</p>
            </div>
            
            {worker.manager_name && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Manager</label>
                <p className="text-sm">{worker.manager_name}</p>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-sm">{new Date(worker.created_at).toLocaleDateString()}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
              <p className="text-sm">{new Date(worker.updated_at).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>
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