
import { useState } from "react"
import { Search, Plus, Edit, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PermissionGate } from "@/components/auth/PermissionGate"
import { AdminModeIndicator } from "@/components/admin/AdminModeIndicator"
import { MemberOrgIndicator } from "@/components/members/MemberOrgIndicator"
import { useAuth } from "@/contexts/AuthContext"
import { Member } from "@/hooks/useMembers"

interface MembersTableProps {
  members: Member[]
  isLoading: boolean
  onEdit: (member: Member) => void
  onDeactivate: (id: string) => void
  onCreateNew: () => void
}

export function MembersTable({ 
  members, 
  isLoading, 
  onEdit, 
  onDeactivate, 
  onCreateNew 
}: MembersTableProps) {
  const { user, organizationId } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")

  const isPlatformAdmin = user?.user_metadata?.user_type === 'platform_admin'

  const filteredMembers = members.filter(member => {
    const matchesSearch = 
      (member.user_email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (member.organization_name?.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === "all" || member.user_status === statusFilter
    const matchesRole = roleFilter === "all" || member.member_role === roleFilter
    
    return matchesSearch && matchesStatus && matchesRole
  })

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive'
      case 'recruiter': return 'default'
      case 'customer_success': return 'secondary'
      case 'billing': return 'outline'
      case 'sales': return 'outline'
      case 'client': return 'secondary'
      default: return 'secondary'
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'inactive': return 'secondary'
      case 'invited': return 'outline'
      default: return 'secondary'
    }
  }

  const formatRole = (role: string) => {
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-token-xl">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            <span className="ml-token-md text-muted-foreground">Loading members...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <AdminModeIndicator />
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {isPlatformAdmin 
                  ? "Manage members across all organizations (Platform Admin Mode)"
                  : "Manage members and their roles within your organization"
                }
              </CardDescription>
            </div>
            <PermissionGate permission="canManageMembers">
              <Button onClick={onCreateNew} className="gap-token-sm">
                <Plus className="h-4 w-4" />
                Invite Member
              </Button>
            </PermissionGate>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Filters */}
          <div className="flex gap-token-md mb-token-lg">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by email or organization..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="recruiter">Recruiter</SelectItem>
                <SelectItem value="customer_success">Customer Success</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-token-xl text-muted-foreground">
                    {searchTerm || statusFilter !== "all" || roleFilter !== "all" 
                      ? "No members found matching your filters" 
                      : "No members found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.user_email || 'Pending invitation'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.member_role)}>
                        {formatRole(member.member_role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{member.organization_name}</span>
                        {isPlatformAdmin && (
                          <MemberOrgIndicator 
                            organizationName={member.organization_name || ''} 
                            currentUserOrgId={organizationId}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(member.user_status)}>
                        {member.user_status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(member.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <PermissionGate permission="canManageMembers">
                        <div className="flex justify-end gap-token-sm">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(member)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {member.user_status !== 'inactive' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeactivate(member.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </PermissionGate>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
