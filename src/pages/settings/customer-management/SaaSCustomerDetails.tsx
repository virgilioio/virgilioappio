import { useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Users, Calendar, CreditCard, Building, Loader2 } from 'lucide-react'
import { useSaaSCustomer } from '@/hooks/useSaaSCustomer'
import { format } from 'date-fns'

export function SaaSCustomerDetails() {
  const { id } = useParams()
  const { data: customer, isLoading, error } = useSaaSCustomer(id!)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading customer details...</span>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Customer not found or you don't have permission to view this customer.
            </p>
          </CardContent>
        </Card>
      </div>
    )
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
              {customer.name}
              <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                {customer.status}
              </Badge>
            </CardTitle>
            <CardDescription>
              {customer.billing_poc_email || 'No billing contact email'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{customer.user_count} active users</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Created {format(new Date(customer.created_at), 'MMM dd, yyyy')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {customer.sub_organizations.length} departments
              </span>
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
              <span className="text-sm font-medium">Business (Estimated)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Estimated Revenue:</span>
              <span className="text-sm font-medium">$299/month</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Type:</span>
              <span className="text-sm font-medium">{customer.organization_type}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {customer.sub_organizations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>
              Sub-organizations managed by {customer.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {customer.sub_organizations.map((subOrg) => (
                <div key={subOrg.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <p className="font-medium">{subOrg.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Created {format(new Date(subOrg.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={subOrg.status === 'active' ? 'default' : 'secondary'}>
                      {subOrg.status}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {subOrg.user_count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}