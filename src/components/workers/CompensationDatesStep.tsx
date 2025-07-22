import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateWorkerData } from '@/hooks/useWorkers'

interface CompensationDatesStepProps {
  data: Partial<CreateWorkerData>
  errors: Record<string, string>
  onUpdate: (data: Partial<CreateWorkerData>) => void
  workerType: 'employee' | 'contractor'
  contractorPaymentType?: 'fixed_rate' | 'hourly_rate' | 'per_project'
}

export function CompensationDatesStep({ 
  data, 
  errors, 
  onUpdate, 
  workerType, 
  contractorPaymentType 
}: CompensationDatesStepProps) {
  const handleChange = (field: keyof CreateWorkerData, value: any) => {
    onUpdate({ [field]: value })
  }

  const paymentPeriods = [
    { value: 'annual', label: 'Annual' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'semimonthly', label: 'Semimonthly' },
    { value: 'biweekly', label: 'Biweekly' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'daily', label: 'Daily' },
    { value: 'hourly', label: 'Hourly' }
  ]

  const currencies = [
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' },
    { value: 'GBP', label: 'GBP - British Pound' },
    { value: 'CAD', label: 'CAD - Canadian Dollar' },
    { value: 'AUD', label: 'AUD - Australian Dollar' },
    { value: 'JPY', label: 'JPY - Japanese Yen' },
    { value: 'CHF', label: 'CHF - Swiss Franc' },
    { value: 'SEK', label: 'SEK - Swedish Krona' },
    { value: 'NOK', label: 'NOK - Norwegian Krone' },
    { value: 'DKK', label: 'DKK - Danish Krone' }
  ]

  const employmentTypes = [
    { value: 'full_time', label: 'Full-time' },
    { value: 'part_time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'temporary', label: 'Temporary' },
    { value: 'internship', label: 'Internship' },
    { value: 'freelance', label: 'Freelance' }
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Compensation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workerType === 'employee' && (
              <div>
                <Label htmlFor="base_salary">Base Salary</Label>
                <Input
                  id="base_salary"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                  value={data.base_salary || ''}
                  onChange={(e) => handleChange('base_salary', parseFloat(e.target.value) || undefined)}
                  className={errors.base_salary ? 'border-destructive' : ''}
                />
                {errors.base_salary && (
                  <p className="text-sm text-destructive mt-1">{errors.base_salary}</p>
                )}
              </div>
            )}

            {workerType === 'contractor' && contractorPaymentType === 'hourly_rate' && (
              <div>
                <Label htmlFor="hourly_rate">Hourly Rate *</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={data.hourly_rate || ''}
                  onChange={(e) => handleChange('hourly_rate', parseFloat(e.target.value) || undefined)}
                  className={errors.hourly_rate ? 'border-destructive' : ''}
                />
                {errors.hourly_rate && (
                  <p className="text-sm text-destructive mt-1">{errors.hourly_rate}</p>
                )}
              </div>
            )}

            {workerType === 'contractor' && contractorPaymentType === 'fixed_rate' && (
              <div>
                <Label htmlFor="monthly_fixed_amount">Monthly Fixed Amount *</Label>
                <Input
                  id="monthly_fixed_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={data.monthly_fixed_amount || ''}
                  onChange={(e) => handleChange('monthly_fixed_amount', parseFloat(e.target.value) || undefined)}
                  className={errors.monthly_fixed_amount ? 'border-destructive' : ''}
                />
                {errors.monthly_fixed_amount && (
                  <p className="text-sm text-destructive mt-1">{errors.monthly_fixed_amount}</p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="currency">Currency *</Label>
              <Select
                value={data.currency || 'USD'}
                onValueChange={(value) => handleChange('currency', value)}
              >
                <SelectTrigger className={errors.currency ? 'border-destructive' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.currency && (
                <p className="text-sm text-destructive mt-1">{errors.currency}</p>
              )}
            </div>

            <div>
              <Label htmlFor="payment_period">Payment Period *</Label>
              <Select
                value={data.payment_period || 'monthly'}
                onValueChange={(value) => handleChange('payment_period', value)}
              >
                <SelectTrigger className={errors.payment_period ? 'border-destructive' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentPeriods.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.payment_period && (
                <p className="text-sm text-destructive mt-1">{errors.payment_period}</p>
              )}
            </div>

            <div>
              <Label htmlFor="employment_type">Employment Type</Label>
              <Select
                value={data.contract_type || ''}
                onValueChange={(value) => handleChange('contract_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employment type" />
                </SelectTrigger>
                <SelectContent>
                  {employmentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agreement Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Agreement Start Date *</Label>
              <Input
                id="start_date"
                type="date"
                value={data.start_date || ''}
                onChange={(e) => handleChange('start_date', e.target.value)}
                className={errors.start_date ? 'border-destructive' : ''}
              />
              {errors.start_date && (
                <p className="text-sm text-destructive mt-1">{errors.start_date}</p>
              )}
            </div>

            <div>
              <Label htmlFor="employment_terms">Employment Terms *</Label>
              <Select
                value={data.employment_terms || 'indefinite'}
                onValueChange={(value) => handleChange('employment_terms', value)}
              >
                <SelectTrigger className={errors.employment_terms ? 'border-destructive' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="indefinite">Indefinite</SelectItem>
                  <SelectItem value="definite">Definite</SelectItem>
                </SelectContent>
              </Select>
              {errors.employment_terms && (
                <p className="text-sm text-destructive mt-1">{errors.employment_terms}</p>
              )}
            </div>

            {data.employment_terms === 'definite' && (
              <div>
                <Label htmlFor="end_date">Agreement End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={data.end_date || ''}
                  onChange={(e) => handleChange('end_date', e.target.value)}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}