import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck } from 'lucide-react'

interface WorkerTypeSelectionProps {
  onSelect: (type: 'employee' | 'contractor') => void
}

export function WorkerTypeSelection({ onSelect }: WorkerTypeSelectionProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-center mb-6">
        Please choose the worker type you'd like to onboard.
      </p>
      
      <div className="space-y-3">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
          onClick={() => onSelect('employee')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Employee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              A full-time or part-time worker hired directly by your company.
            </CardDescription>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/50"
          onClick={() => onSelect('contractor')}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-lg">
              <UserCheck className="h-5 w-5 text-primary" />
              Independent Contractor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">
              An independent worker hired for specific tasks or projects, not on payroll.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}