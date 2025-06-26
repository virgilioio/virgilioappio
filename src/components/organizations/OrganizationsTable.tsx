import { useState, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Edit, Trash2, Building2, User, Calendar, Eye, Search, ChevronLeft, ChevronRight, MoreHorizontal, FileText } from 'lucide-react'
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
  const [countryFilter, setCountryFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  
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

  // Helper function to display owner information with fallback
  const displayOwnerInfo = (org: Organization) => {
    if (org.owner_email) {
      return (
        <div className="flex items-center gap-1 text-sm">
          <User className="h-3 w-3" />
          {org.owner_email}
        </div>
      )
    }
    
    if (org.owner_id) {
      return (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <User className="h-3 w-3" />
          User ID: {org.owner_id.slice(0, 8)}...
        </div>
      )
    }
    
    return <span className="text-muted-foreground text-sm">No owner</span>
  }

  // Helper function to display creator information with fallback
  const displayCreatorInfo = (org: Organization) => {
    if (org.created_by_email) {
      return <span className="text-sm">{org.created_by_email}</span>
    }
    
    if (org.created_by) {
      return (
        <span className="text-sm text-muted-foreground">
          User ID: {org.created_by.slice(0, 8)}...
        </span>
      )
    }
    
    return <span className="text-muted-foreground text-sm">Unknown</span>
  }

  // Get unique values for filters
  const uniqueCountries = [...new Set(organizations.map(org => org.country).filter(Boolean))]
  const uniqueTypes = [...new Set(organizations.map(org => org.organization_type).filter(Boolean))]

  // Filter organizations
  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (org.owner_email && org.owner_email.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesStatus = statusFilter === 'all' || org.status === statusFilter
    const matchesCountry = countryFilter === 'all' || org.country === countryFilter
    const matchesType = typeFilter === 'all' || org.organization_type === typeFilter
    
    return matchesSearch && matchesStatus && matchesCountry && matchesType
  })

  // Calculate pagination
  const totalPages = Math.ceil(filteredOrganizations.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedOrganizations = filteredOrganizations.slice(startIndex, endIndex)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, countryFilter, typeFilter])

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
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Filter by country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {uniqueCountries.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
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
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {organizations.length === 0 ? 'No organizations yet' : 'No organizations match your filters'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {organizations.length === 0 
                  ? 'Create your first organization to get started.'
                  : 'Try adjusting your search or filter criteria.'
                }
              </p>
              {organizations.length === 0 && permissions.canCreateOrganizations && onCreateNew && (
                <Button onClick={onCreateNew} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Organization
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrganizations.map((org) => (
                      <TableRow key={org.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewDetails(org)}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell>{org.country}</TableCell>
                        <TableCell>
                          <Badge variant={org.status === 'active' ? 'default' : 'secondary'}>
                            {org.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {org.organization_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {displayOwnerInfo(org)}
                        </TableCell>
                        <TableCell>
                          {displayCreatorInfo(org)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(org.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleViewDetails(org); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {permissions.canEditOrganizations && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); onEdit(org); }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {permissions.canDeleteOrganizations && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); onDelete(org.id); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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
