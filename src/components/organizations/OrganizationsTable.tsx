
import { useState, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Edit, Trash2, Building2, Search, ChevronLeft, ChevronRight, MoreHorizontal, Eye } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Organization } from '@/hooks/useOrganizations'
import { usePermissions } from '@/hooks/usePermissions'
import { Skeleton } from '@/components/ui/skeleton'
import { OrganizationDetailsDialog } from './OrganizationDetailsDialog'

interface OrganizationsTableProps {
  organizations: Organization[]
  isLoading: boolean
  onEdit: (organization: Organization) => void
  onDelete: (id: string) => void
  onCreateNew?: () => void
}

export function OrganizationsTable({
  organizations,
  isLoading,
  onEdit,
  onDelete,
  onCreateNew
}: OrganizationsTableProps) {
  const permissions = usePermissions()
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const handleViewDetails = (organization: Organization) => {
    setSelectedOrganization(organization)
    setIsDetailsDialogOpen(true)
  }

  const handleCloseDetails = () => {
    setIsDetailsDialogOpen(false)
    setSelectedOrganization(null)
  }


  // Filter organizations
  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || org.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // Calculate pagination
  const totalPages = Math.ceil(filteredOrganizations.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedOrganizations = filteredOrganizations.slice(startIndex, endIndex)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {permissions.canCreateOrganizations && onCreateNew && (
              <Button onClick={onCreateNew} className="gap-2 whitespace-nowrap">
                <Plus className="h-4 w-4" />
                Create Organization
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {filteredOrganizations.length === 0 ? (
            <EmptyState
              assetType="empty-state-organizations"
              title={organizations.length === 0 ? 'No organizations yet' : 'No organizations match your filters'}
              description={organizations.length === 0 
                ? 'Create your first organization to get started.'
                : 'Try adjusting your search or filter criteria.'
              }
              fallbackIcon={Building2}
              action={organizations.length === 0 && permissions.canCreateOrganizations && onCreateNew ? {
                label: 'Create Organization',
                onClick: onCreateNew
              } : undefined}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
            <TableRow>
              <TableHead className="w-1/2">Name</TableHead>
              <TableHead className="w-1/4">Status</TableHead>
              <TableHead className="w-1/4 text-right">Actions</TableHead>
            </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrganizations.map((org) => (
                      <TableRow key={org.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewDetails(org)}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                         <TableCell>
                           <Badge 
                             variant={org.status === 'active' ? 'default' : 'secondary'}
                             className={org.status === 'active' ? 'bg-[#d2ffc2] text-green-800 hover:bg-[#c2f0b2]' : ''}
                           >
                             {org.status === 'active' ? 'Active' : 'Inactive'}
                           </Badge>
                         </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                                className="h-8 w-8 p-0"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-background border z-50">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetails(org); }}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {permissions.canEditOrganizations && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(org); }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {permissions.canDeleteOrganizations && (
                                <DropdownMenuItem 
                                  onClick={(e) => { e.stopPropagation(); onDelete(org.id); }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Beautiful Enhanced Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-8 space-y-6">
                  {/* Results Summary Card */}
                  <div className="flex justify-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-secondary/50 border border-border/50 rounded-brand text-sm text-text-secondary backdrop-blur-sm">
                      <Building2 className="h-4 w-4 opacity-60" />
                      <span className="font-medium">
                        Showing {startIndex + 1}-{Math.min(endIndex, filteredOrganizations.length)} of {filteredOrganizations.length} organizations
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

      <OrganizationDetailsDialog
        organization={selectedOrganization}
        isOpen={isDetailsDialogOpen}
        onClose={handleCloseDetails}
      />
    </>
  )
}
