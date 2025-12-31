import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SuspendOrganizationDialog } from '@/components/settings/SuspendOrganizationDialog'
import { useSuspendOrganization } from '@/hooks/useSaaSAdminActions'
import { CustomerHealthBadge } from '@/components/saas/CustomerHealthBadge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Search, Users, Briefcase, Activity } from 'lucide-react'
import { useSaaSCustomers } from '@/hooks/useSaaSCustomers'
import { PageHeader } from '@/components/layout/PageHeader'
import { TableSkeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'

export function SaaSCustomersList() {
  const navigate = useNavigate()
  const { data: customers, isLoading } = useSaaSCustomers()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<{ id: string; name: string } | null>(null)
  const suspendMutation = useSuspendOrganization()

  const filteredCustomers = customers?.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || customer.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'trialing': return 'secondary'
      case 'locked': return 'destructive'
      case 'suspended': return 'destructive'
      case 'past_due': return 'outline'
      case 'canceled': return 'outline'
      case 'cancelled': return 'outline'
      default: return 'default'
    }
  }

  const getPlanVariant = (plan: string | null) => {
    switch (plan) {
      case 'enterprise': return 'default'
      case 'pro': return 'secondary'
      case 'starter': return 'outline'
      case 'trial': return 'destructive'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="SaaS Customers" 
        subtitle="Manage SaaS paying customers and their subscriptions"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="locked">Locked</option>
              <option value="suspended">Suspended</option>
              <option value="past_due">Past Due</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={8} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Owner Contact</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Churn Risk</TableHead>
                  <TableHead>Renewal</TableHead>
                  <TableHead>Usage (30d)</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers?.map((customer) => (
                  <TableRow 
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/settings/platform/saas-customers/${customer.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Created {format(new Date(customer.created_at), 'MMM d, yyyy')}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        {customer.owner_id ? (
                          <>
                            <div>Contact Available</div>
                            <div className="text-muted-foreground">Click to view</div>
                          </>
                        ) : (
                          <div className="text-muted-foreground">No owner assigned</div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={getPlanVariant(customer.plan_type)}>
                        {customer.plan_type || 'No Plan'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={getStatusVariant(customer.status)}>
                        {customer.status}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <CustomerHealthBadge health={customer.churn_risk} />
                    </TableCell>
                    
                    <TableCell>
                      {customer.renewal_date ? (
                        format(new Date(customer.renewal_date), 'MMM d, yyyy')
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {customer.jobs_created_30d}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {customer.candidates_added_30d}
                        </div>
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          {customer.members_active_count}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {customer.last_active_at ? (
                        format(new Date(customer.last_active_at), 'MMM d')
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/settings/platform/saas-customers/${customer.id}`)
                          }}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedOrg({ id: customer.id, name: customer.name })
                              setSuspendDialogOpen(true)
                            }}
                            disabled={customer.status === 'suspended'}
                          >
                            Suspend Account
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                            Change Plan
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {filteredCustomers?.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              No customers found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {selectedOrg && (
        <SuspendOrganizationDialog
          open={suspendDialogOpen}
          onOpenChange={setSuspendDialogOpen}
          onConfirm={(reason) => {
            suspendMutation.mutate({ tenantId: selectedOrg.id, reason })
            setSuspendDialogOpen(false)
          }}
          organizationName={selectedOrg.name}
          isPending={suspendMutation.isPending}
        />
      )}
    </div>
  )
}