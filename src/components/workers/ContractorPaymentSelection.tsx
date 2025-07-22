import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Clock, CheckSquare } from 'lucide-react'

interface ContractorPaymentSelectionProps {
  onSelect: (type: 'fixed_rate' | 'hourly_rate' | 'per_project') => void
}

export function ContractorPaymentSelection({ onSelect }: ContractorPaymentSelectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-center mb-6">
        How would you like to structure the payment for this contractor?
      </p>
      
      <div className="space-y-3">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
          onClick={() => onSelect('fixed_rate')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-lg">
              <DollarSign className="h-5 w-5 text-primary" />
              Fixed Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              A set monthly amount paid to the contractor, regardless of hours worked.
            </CardDescription>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
          onClick={() => onSelect('hourly_rate')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              Hourly Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              Payment based on the number of hours worked, at a specified hourly rate.
            </CardDescription>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
          onClick={() => onSelect('per_project')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-lg">
              <CheckSquare className="h-5 w-5 text-primary" />
              Per Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              Payment is made upon completion of a specific project or predefined milestones.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}