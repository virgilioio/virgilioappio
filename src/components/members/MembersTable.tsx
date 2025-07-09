
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Search, Edit, UserMinus, Mail, Plus, ChevronLeft, ChevronRight, MoreHorizontal, Users, Link, Copy } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Member, useMembers } from '@/hooks/useMembers'
import { usePermissions } from '@/hooks/usePermissions'
import { useOrganizations } from '@/hooks/useOrganizations'
import { MemberOrgIndicator } from './MemberOrgIndicator'
import { copyToClipboard } from '@/utils/clipboard'

interface MembersTableProps {
  members: Member[]
  isLoading: boolean
  onEdit: (member: Member) => void
  onDeactivate: (id: string) => void
  onResendInvitation: (id: string, email: string) => void
  onAddNew?: () => void
}

export function MembersTable({ 
  members, 
  isLoading, 
  onEdit, 
  onDeactivate, 
  onResendInvitation,
  onAddNew
}: MembersTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [organizationFilter, setOrganizationFilter] = useState<string>('all')
  const permissions = usePermissions()
  const { organizations } = useOrganizations()
  const { getInviteUrl } = useMembers()
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'invited':
        return 'secondary'
      case 'inactive':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const filteredMembers = members.filter(member => {
    const email = member.invited_email || member.user_email || ''
    const firstName = member.user_first_name || ''
    const lastName = member.user_last_name || ''
    const fullName = `${firstName} ${lastName}`.trim()
    
    const matchesSearch = email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         fullName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || member.user_status === statusFilter
    const matchesRole = roleFilter === 'all' || member.member_role === roleFilter
    const matchesOrganization = organizationFilter === 'all' || member.organization_id === organizationFilter
    
    return matchesSearch && matchesStatus && matchesRole && matchesOrganization
  })

  // Calculate pagination
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedMembers = filteredMembers.slice(startIndex, endIndex)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, roleFilter, organizationFilter])

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Show first page
      pages.push(1)
      
      if (currentPage > 4) {
        pages.push('ellipsis')
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (currentPage < totalPages - 3) {
        pages.push('ellipsis')
      }
      
      // Show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  const handleCopyInviteLink = async (memberId: string) => {
    try {
      const inviteUrl = await getInviteUrl(memberId)
      copyToClipboard(inviteUrl, 'Invitation link copied!')
    } catch (error) {
      console.error('Failed to copy invite link:', error)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>

          {/* Organization Filter - Only visible to platform admins */}
          {permissions.isPlatformAdmin && (
            <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          )}

          {permissions.canManageMembers && onAddNew && (
            <Button onClick={onAddNew} className="gap-2 whitespace-nowrap">
              <Plus className="h-4 w-4" />
              Add Member
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {members.length === 0 ? 'No team members found' : 'No members match your filters'}
          </div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMembers.map((member) => {
                    const firstName = member.user_first_name || ''
                    const lastName = member.user_last_name || ''
                    const fullName = `${firstName} ${lastName}`.trim()
                    const displayName = fullName || member.invited_email
                    
                    return (
                      <TableRow key={member.id} interactive onClick={() => onEdit(member)}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{displayName}</div>
                            {fullName && member.invited_email && (
                              <div className="text-sm text-muted-foreground">{member.invited_email}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.organization_name && (
                            <MemberOrgIndicator 
                              organizationName={member.organization_name}
                              currentUserOrgId={member.organization_id}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{member.member_role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(member.user_status)}>
                            {member.user_status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(member.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {permissions.canManageMembers && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(member); }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Member
                                </DropdownMenuItem>
                              )}
                              {member.user_status === 'invited' && permissions.canManageMembers && (
                                <>
                                  <DropdownMenuItem onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handleCopyInviteLink(member.id); 
                                  }}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copy Invite Link
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => { 
                                    e.stopPropagation(); 
                                    onResendInvitation(member.id, member.invited_email || ''); 
                                  }}>
                                    <Mail className="h-4 w-4 mr-2" />
                                    Resend Invitation
                                  </DropdownMenuItem>
                                </>
                              )}
                              {permissions.canManageMembers && member.user_status !== 'inactive' && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeactivate(member.id); }}>
                                  <UserMinus className="h-4 w-4 mr-2" />
                                  Deactivate Member
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Beautiful Enhanced Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 space-y-6">
                {/* Results Summary Card */}
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-secondary/50 border border-border/50 rounded-brand text-sm text-text-secondary backdrop-blur-sm">
                    <Users className="h-4 w-4 opacity-60" />
                    <span className="font-medium">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredMembers.length)} of {filteredMembers.length} members
                    </span>
                  </div>
                </div>
                
                {/* Enhanced Pagination Navigation */}
                <div className="flex justify-center">
                  <div className="inline-flex items-center bg-surface-primary border border-border/80 rounded-brand shadow-sm p-1 gap-1">
                    {/* Previous Button */}
                    <button
                      onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`
                        inline-flex items-center gap-2 px-3 py-2 rounded-brand text-sm font-medium transition-all duration-200 ease-out
                        ${currentPage === 1 
                          ? 'text-text-tertiary cursor-not-allowed opacity-50' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:-translate-y-0.5 hover:shadow-sm active:scale-95'
                        }
                      `}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1 px-2">
                      {getPageNumbers().map((page, index) => (
                        <div key={index}>
                          {page === 'ellipsis' ? (
                            <div className="flex items-center justify-center w-8 h-8 text-text-tertiary">
                              <MoreHorizontal className="h-4 w-4" />
                            </div>
                          ) : (
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`
                                w-8 h-8 rounded-brand text-sm font-medium transition-all duration-200 ease-out
                                ${currentPage === page
                                  ? 'bg-accent text-accent-foreground shadow-sm scale-105 font-semibold'
                                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:-translate-y-0.5 hover:shadow-sm active:scale-95'
                                }
                              `}
                            >
                              {page}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Next Button */}
                    <button
                      onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`
                        inline-flex items-center gap-2 px-3 py-2 rounded-brand text-sm font-medium transition-all duration-200 ease-out
                        ${currentPage === totalPages 
                          ? 'text-text-tertiary cursor-not-allowed opacity-50' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:-translate-y-0.5 hover:shadow-sm active:scale-95'
                        }
                      `}
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Mobile Simplified Pagination */}
                <div className="sm:hidden flex justify-center">
                  <div className="inline-flex items-center gap-4 px-4 py-2 bg-surface-secondary/30 border border-border/50 rounded-brand backdrop-blur-sm">
                    <button
                      onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`
                        p-2 rounded-brand transition-all duration-200
                        ${currentPage === 1 
                          ? 'text-text-tertiary cursor-not-allowed opacity-50' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:scale-105 active:scale-95'
                        }
                      `}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-text-secondary">Page</span>
                      <span className="font-medium text-text-primary bg-accent/20 px-2 py-1 rounded-brand">
                        {currentPage}
                      </span>
                      <span className="text-text-secondary">of {totalPages}</span>
                    </div>
                    
                    <button
                      onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`
                        p-2 rounded-brand transition-all duration-200
                        ${currentPage === totalPages 
                          ? 'text-text-tertiary cursor-not-allowed opacity-50' 
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary hover:scale-105 active:scale-95'
                        }
                      `}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
