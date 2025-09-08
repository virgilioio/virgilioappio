import { useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Users, Calendar, CreditCard } from 'lucide-react'

export function SaaSCustomerDetails() {
  const { id } = useParams()
  
  // Placeholder data - replace with actual data fetching
  const mockCustomer = {
    id,
    name: "Acme Corp",
    status: "active",
    users: 25,
    plan: "Business",
    createdAt: "2024-01-15",
    lastActivity: "2024-03-01",
    email: "admin@acmecorp.com",
    billing: {
      nextPayment: "2024-03-15",
      amount: "$299/month"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {mockCustomer.name}
              <Badge variant={mockCustomer.status === 'active' ? 'default' : 'secondary'}>
                {mockCustomer.status}
              </Badge>
            </CardTitle>
            <CardDescription>{mockCustomer.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{mockCustomer.users} active users</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Created {mockCustomer.createdAt}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Plan:</span>
              <span className="text-sm font-medium">{mockCustomer.plan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Amount:</span>
              <span className="text-sm font-medium">{mockCustomer.billing.amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Next Payment:</span>
              <span className="text-sm font-medium">{mockCustomer.billing.nextPayment}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}