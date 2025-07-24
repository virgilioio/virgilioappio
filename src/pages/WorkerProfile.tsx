
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Phone, MapPin, Building, Calendar, DollarSign, FileText, Plus, MoreHorizontal, X, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkers } from '@/hooks/useWorkers'
import { useWorkerContracts } from '@/hooks/useWorkerContracts'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WorkerComplianceCard } from '@/components/workers/WorkerComplianceCard'
import { useState } from 'react'

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
  const { contracts } = useWorkerContracts(worker.id)
  const activeContract = contracts.find(contract => contract.is_active) || contracts[0] // Get active contract or first one
  const [editGeneralOpen, setEditGeneralOpen] = useState(false)
  const [editOrganizationOpen, setEditOrganizationOpen] = useState(false)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
      case 'terminated':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Terminated</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
      case 'suspended':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Suspended</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }
  return (
    <div className="space-y-6">
      {/* Worker Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {worker.full_name}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-md">
          {worker.full_name} • {activeContract?.job_title || 'No title'} • {worker.organization_name || 'No organization'}
        </p>
      </div>

      {/* Main Content - Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Main Cards */}
        <div className="space-y-4">
          {/* General Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  General Information
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setEditGeneralOpen(true)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Worker ID</span>
                  <span className="text-sm">{worker.worker_id || 'Not assigned'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Personal Email
                  </span>
                  <span className="text-sm">{worker.personal_email || 'Not provided'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Work Email
                  </span>
                  <span className="text-sm">{worker.work_email || 'Not provided'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Personal Phone
                  </span>
                  <span className="text-sm">{worker.personal_phone || 'Not provided'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Country
                  </span>
                  <span className="text-sm">{worker.country || 'Not specified'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">State/Province</span>
                  <span className="text-sm">{worker.state_province || 'Not specified'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Birthday
                  </span>
                  <span className="text-sm">Not available</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Organization Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Organization Information
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setEditOrganizationOpen(true)}
                  disabled={!activeContract}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
             <CardContent className="space-y-3">
               {activeContract ? (
                 <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Department</span>
                      <span className="text-sm">{activeContract.department_name || 'Not specified'}</span>
                    </div>
                   <div className="flex justify-between items-center">
                     <span className="text-sm font-medium text-muted-foreground">Job Title</span>
                     <span className="text-sm">{activeContract.job_title || 'Not specified'}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-sm font-medium text-muted-foreground">Manager Name</span>
                     <span className="text-sm">{activeContract.manager_name || 'Not assigned'}</span>
                   </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Contract Status</span>
                      {getStatusBadge(activeContract.contract_status)}
                    </div>
                   <div className="flex justify-between items-center">
                     <span className="text-sm font-medium text-muted-foreground">Worker Type</span>
                     <span className="text-sm">
                       {activeContract.worker_type === 'employee' ? 'Employee' : 'Contractor'}
                     </span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-sm font-medium text-muted-foreground">Reports</span>
                     <span className="text-sm">
                       {worker.reports && worker.reports.length > 0 
                         ? `${worker.reports.length} direct report(s)`
                         : 'No direct reports'
                       }
                     </span>
                   </div>
                 </div>
               ) : (
                 <div className="text-center py-4">
                   <p className="text-sm text-muted-foreground">No active contract found</p>
                   <p className="text-xs text-muted-foreground">Organization information will be available when a contract is created</p>
                 </div>
               )}
             </CardContent>
          </Card>
        </div>

        {/* Right Column - Empty for now */}
        <div className="space-y-4">
          {/* This column is reserved for future content */}
        </div>
      </div>

      {/* Edit General Information Dialog */}
      <EditGeneralDialog 
        open={editGeneralOpen}
        onOpenChange={setEditGeneralOpen}
        worker={worker}
      />

      {/* Edit Organization Information Dialog */}
      <EditOrganizationDialog 
        open={editOrganizationOpen}
        onOpenChange={setEditOrganizationOpen}
        contract={activeContract}
        worker={worker}
      />
    </div>
  )
}

// Contract Tab Content
function ContractContent({ worker }: { worker: any }) {
  const { contracts, isLoading: contractsLoading } = useWorkerContracts(worker.id)
  const [selectedContract, setSelectedContract] = useState<any>(null)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
      case 'terminated':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Terminated</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
      case 'suspended':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Suspended</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // If a contract is selected, show contract details
  if (selectedContract) {
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          onClick={() => setSelectedContract(null)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Contracts
        </Button>
        <ContractProfileContent contract={selectedContract} worker={worker} />
      </div>
    )
  }

  // Show contracts list
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contracts
          </CardTitle>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        </CardHeader>
        <CardContent>
          {contractsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            </div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No contracts found for this worker.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract Number</TableHead>
                  <TableHead>Amount (Base Salary)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow 
                    key={contract.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedContract(contract)}
                  >
                    <TableCell className="font-medium">{contract.contract_number}</TableCell>
                    <TableCell>
                      {contract.base_salary 
                        ? `${contract.currency || 'USD'} ${contract.base_salary.toLocaleString()}`
                        : 'Not specified'
                      }
                    </TableCell>
                    <TableCell>{getStatusBadge(contract.contract_status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Contract Profile Content
function ContractProfileContent({ contract, worker }: { contract: any; worker: any }) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
      case 'terminated':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Terminated</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
      case 'suspended':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Suspended</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Contract Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          {contract.contract_number}
        </h2>
        <p className="text-muted-foreground mt-1">
          {worker.full_name} • {contract.job_title || 'No title specified'}
        </p>
      </div>

      {/* Main Content - Two columns in 1:1 ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Contract Information */}
        <div className="space-y-4">
          {/* Contract Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Contract Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Created At</span>
                <span className="text-sm">{contract.created_at ? new Date(contract.created_at).toLocaleDateString() : 'Not specified'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Start Date</span>
                <span className="text-sm">{contract.start_date ? new Date(contract.start_date).toLocaleDateString() : 'Not specified'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">End Date</span>
                <span className="text-sm">{contract.end_date ? new Date(contract.end_date).toLocaleDateString() : 'Not specified'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Worker Type</span>
                <span className="text-sm capitalize">{contract.worker_type || 'Not specified'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Job Title</span>
                <span className="text-sm">{contract.job_title || 'Not specified'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Seniority Level</span>
                <span className="text-sm capitalize">{contract.seniority_level?.replace('_', ' ') || 'Not specified'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Contract Type</span>
                <span className="text-sm capitalize">{contract.contract_type || 'Not specified'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Working Location</span>
                <span className="text-sm">{contract.working_location || 'Not specified'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                {getStatusBadge(contract.contract_status)}
              </div>
              {contract.scope_of_work && (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Scope of Work</span>
                  <ul className="text-sm space-y-1">
                    {contract.scope_of_work.split('\n').map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{item.trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Compensation Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Compensation Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Base Salary</span>
                <span className="text-sm">{contract.base_salary ? `${contract.currency || 'USD'} ${contract.base_salary.toLocaleString()}` : 'Not specified'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Currency</span>
                <span className="text-sm">{contract.currency || 'USD'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Salary Frequency</span>
                <span className="text-sm capitalize">{contract.payment_period || 'Not specified'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Payment Cycle</span>
                <span className="text-sm">
                  {contract.payment_frequency === 'bi_monthly' 
                    ? 'Every 15th and last of the month'
                    : contract.payment_frequency === 'monthly'
                    ? 'Last of every month'
                    : contract.payment_frequency?.replace('_', ' ') || 'Not specified'
                  }
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-4">

          {/* Agreement */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Agreement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Agreement ID</span>
                  <span className="text-sm">{contract.id || 'Not available'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Contract Status</span>
                  {getStatusBadge(contract.contract_status)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Creation Date</span>
                  <span className="text-sm">{contract.created_at ? new Date(contract.created_at).toLocaleDateString() : 'Not available'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Documents Tab Content
function DocumentsContent({ worker }: { worker: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Compliance Information */}
      <div>
        <WorkerComplianceCard worker={worker} />
      </div>
      
      {/* Right Column - General Documents */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle>General Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">General document management features coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Edit General Information Dialog
function EditGeneralDialog({ 
  open, 
  onOpenChange, 
  worker 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  worker: any 
}) {
  const [formData, setFormData] = useState({
    personal_email: worker.personal_email || '',
    work_email: worker.work_email || '',
    personal_phone: worker.personal_phone || '',
    country: worker.country || '',
    state_province: worker.state_province || ''
  })

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log('Saving general info:', formData)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit General Information</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="personal_email">Personal Email</Label>
            <Input
              id="personal_email"
              value={formData.personal_email}
              onChange={(e) => setFormData(prev => ({ ...prev, personal_email: e.target.value }))}
              placeholder="Enter personal email"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="work_email">Work Email</Label>
            <Input
              id="work_email"
              value={formData.work_email}
              onChange={(e) => setFormData(prev => ({ ...prev, work_email: e.target.value }))}
              placeholder="Enter work email"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="personal_phone">Personal Phone</Label>
            <Input
              id="personal_phone"
              value={formData.personal_phone}
              onChange={(e) => setFormData(prev => ({ ...prev, personal_phone: e.target.value }))}
              placeholder="Enter personal phone"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
              placeholder="Enter country"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="state_province">State/Province</Label>
            <Input
              id="state_province"
              value={formData.state_province}
              onChange={(e) => setFormData(prev => ({ ...prev, state_province: e.target.value }))}
              placeholder="Enter state/province"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Edit Organization Information Dialog
function EditOrganizationDialog({ 
  open, 
  onOpenChange, 
  contract,
  worker 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  contract: any;
  worker: any 
}) {
  const [formData, setFormData] = useState({
    job_title: contract?.job_title || '',
    manager_name: contract?.manager_name || '',
    worker_type: contract?.worker_type || '',
    department_id: contract?.department_id || ''
  })

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log('Saving organization info:', formData)
    onOpenChange(false)
  }

  if (!contract) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Organization Information</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="job_title">Job Title</Label>
            <Input
              id="job_title"
              value={formData.job_title}
              onChange={(e) => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
              placeholder="Enter job title"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="manager_name">Manager Name</Label>
            <Input
              id="manager_name"
              value={formData.manager_name}
              onChange={(e) => setFormData(prev => ({ ...prev, manager_name: e.target.value }))}
              placeholder="Enter manager name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="worker_type">Worker Type</Label>
            <Select 
              value={formData.worker_type} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, worker_type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select worker type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
