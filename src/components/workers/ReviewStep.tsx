
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateWorkerData } from '@/hooks/useWorkers'
import { Mail, Phone, MapPin, Building, Calendar, DollarSign, Clock, FileText } from 'lucide-react'

interface ReviewStepProps {
  data: Partial<CreateWorkerData>
  errors: Record<string, string>
  onUpdate: (data: Partial<CreateWorkerData>) => void
  workerType: 'employee' | 'contractor'
  contractorPaymentType?: 'fixed_rate' | 'hourly_rate' | 'per_project'
}

export function ReviewStep({ data, workerType, contractorPaymentType }: ReviewStepProps) {
  const formatCurrency = (amount: number | undefined, currency: string = 'USD') => {
    if (!amount) return 'Not specified'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Not specified'
    // Parse the date string directly without timezone conversion
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getPaymentPeriodLabel = (period: string | undefined) => {
    const labels: Record<string, string> = {
      annual: 'Annual',
      monthly: 'Monthly',
      semimonthly: 'Semimonthly',
      biweekly: 'Biweekly',
      weekly: 'Weekly',
      daily: 'Daily',
      hourly: 'Hourly'
    }
    return labels[period || ''] || 'Not specified'
  }

  const getSeniorityLabel = (level: string | undefined) => {
    const labels: Record<string, string> = {
      entry: 'Entry Level',
      junior: 'Junior',
      mid: 'Mid Level',
      senior: 'Senior',
      lead: 'Lead',
      principal: 'Principal',
      director: 'Director',
      vp: 'Vice President',
      c_level: 'C-Level'
    }
    return labels[level || ''] || 'Not specified'
  }

  const getWorkerTypeColor = (type: string) => {
    return type === 'employee' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
  }

  return (
    <div className="space-y-6">
      <div className="text-center p-4 bg-muted/50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Review Worker Information</h3>
        <p className="text-sm text-muted-foreground">
          Please review all the information below before creating the worker profile.
        </p>
      </div>

      {/* Personal Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Personal Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Full Name</p>
              <p className="text-sm text-muted-foreground">
                {data.legal_first_name} {data.legal_last_name}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Citizenship</p>
              <p className="text-sm text-muted-foreground">
                {data.citizenship || 'Not specified'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Country of Residence</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {data.country || 'Not specified'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Worker Type</p>
              <Badge className={getWorkerTypeColor(workerType)}>
                {workerType === 'employee' ? 'Employee' : 'Contractor'}
                {workerType === 'contractor' && contractorPaymentType && (
                  <span className="ml-1">
                    ({contractorPaymentType.replace('_', ' ')})
                  </span>
                )}
              </Badge>
            </div>
            {workerType === 'contractor' && data.worker_entity_type && (
              <div>
                <p className="text-sm font-medium">Entity Type</p>
                <Badge className={data.worker_entity_type === 'individual' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                  {data.worker_entity_type === 'individual' ? 'Individual' : 'Corporation'}
                </Badge>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-sm font-medium">Personal Email</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {data.personal_email || 'Not specified'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Work Email</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {data.work_email || 'Not specified'}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-medium">Personal Phone</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {data.personal_phone || 'Not specified'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Job Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Job Title</p>
              <p className="text-sm text-muted-foreground">
                {data.job_title || 'Not specified'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Seniority Level</p>
              <p className="text-sm text-muted-foreground">
                {getSeniorityLabel(data.seniority_level)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Department</p>
              <p className="text-sm text-muted-foreground">
                {data.department || 'Not specified'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Working Location</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {data.working_location || 'Not specified'}
              </p>
            </div>
          </div>
          
          {data.scope_of_work && (
            <div className="pt-2">
              <p className="text-sm font-medium">Scope of Work</p>
              <p className="text-sm text-muted-foreground">
                {data.scope_of_work}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compensation & Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Compensation & Dates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workerType === 'employee' && data.base_salary && (
              <div>
                <p className="text-sm font-medium">Base Salary</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(data.base_salary, data.currency)}
                </p>
              </div>
            )}
            
            {workerType === 'contractor' && contractorPaymentType === 'hourly_rate' && (
              <div>
                <p className="text-sm font-medium">Hourly Rate</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(data.hourly_rate, data.currency)} / hour
                </p>
              </div>
            )}
            
            {workerType === 'contractor' && contractorPaymentType === 'fixed_rate' && (
              <div>
                <p className="text-sm font-medium">Monthly Fixed Amount</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(data.monthly_fixed_amount, data.currency)} / month
                </p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium">Currency</p>
              <p className="text-sm text-muted-foreground">
                {data.currency || 'USD'}
              </p>
            </div>
            
            <div>
              <p className="text-sm font-medium">Payment Period</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {getPaymentPeriodLabel(data.payment_period)}
              </p>
            </div>
            
            <div>
              <p className="text-sm font-medium">Employment Terms</p>
              <Badge variant="outline">
                {data.employment_term === 'indefinite' ? 'Indefinite' : 'Definite'}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-sm font-medium">Start Date</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(data.start_date)}
              </p>
            </div>
            
            {data.employment_term === 'definite' && data.end_date && (
              <div>
                <p className="text-sm font-medium">End Date</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(data.end_date)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
