import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, UserPlus, MapPin, DollarSign, FileText, Search, ChevronLeft, ChevronRight, MoreHorizontal, Mail, Phone, ExternalLink, ListChecks, Archive } from 'lucide-react'
import { PermissionGate } from '@/components/auth/PermissionGate'

import { IndependentCandidate } from '@/hooks/useIndependentCandidates'
import BulkAddToJobPipelineDialog from '@/components/candidates/BulkAddToJobPipelineDialog'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'

interface IndependentCandidateTableProps {
  candidates: IndependentCandidate[]
  isLoading: boolean
  onEdit: (candidate: IndependentCandidate) => void
  onDelete: (candidateId: string) => void
  onAddNew: () => void
  onRefresh?: () => void
}


export function IndependentCandidateTable({ 
  candidates, 
  isLoading, 
  onEdit, 
  onDelete, 
  onAddNew,
  onRefresh,
}: IndependentCandidateTableProps) {
  
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [skillsFilter, setSkillsFilter] = useState<string>('all')
  
  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10


  const handleViewProfile = (candidateId: string) => {
    navigate(`/candidates/${candidateId}`)
  }

  const handleDelete = (candidateId: string) => {
    if (confirm('Are you sure you want to delete this candidate?')) {
      onDelete(candidateId)
    }
  }

  const formatLocation = (candidate: IndependentCandidate) => {
    const parts = []
    if (candidate.location_city) parts.push(candidate.location_city)
    if (candidate.location_state) parts.push(candidate.location_state)
    if (candidate.location_country) {
      const countryAbbrev = getCountryAbbreviation(candidate.location_country)
      parts.push(countryAbbrev)
    }
    return parts.length > 0 ? parts.join(', ') : 'Not specified'
  }

  const getCountryAbbreviation = (country: string) => {
    const abbreviations: Record<string, string> = {
      'Mexico': 'MX',
      'United States': 'US',
      'Canada': 'CA',
      'United Kingdom': 'UK',
      'Germany': 'DE',
      'France': 'FR',
      'Spain': 'ES',
      'Brazil': 'BR',
      'Argentina': 'AR'
    }
    return abbreviations[country] || country
  }

  const formatSalary = (candidate: IndependentCandidate) => {
    if (!candidate.salary_amount) return 'Not specified'
    
    const currency = candidate.salary_currency || 'USD'
    const amount = candidate.salary_amount.toLocaleString()
    const period = candidate.salary_period || 'annually'
    
    const currencySymbol = getCurrencySymbol(currency)
    const periodAbbrev = getPeriodAbbreviation(period)
    
    return `${currencySymbol}${amount} ${currency}${periodAbbrev}`
  }

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'MXN': '$',
      'CAD': '$',
      'AUD': '$'
    }
    return symbols[currency] || '$'
  }

  const getPeriodAbbreviation = (period: string) => {
    const abbreviations: Record<string, string> = {
      'hourly': '/hr',
      'monthly': '/mo',
      'annually': '/yr'
    }
    return abbreviations[period] || '/yr'
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'available': 'bg-accent/20 text-accent-foreground',
      'interviewing': 'bg-primary/20 text-primary-foreground',
      'hired': 'bg-success/20 text-success-foreground',
      'inactive': 'bg-muted text-muted-foreground'
    }
    return colors[status] || 'bg-muted text-muted-foreground'
  }

  // Get unique skills for filter
  const allSkills = candidates.flatMap(c => c.skills || [])
  const uniqueSkills = Array.from(new Set(allSkills)).sort()

  // Filter logic
  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch = candidate.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (candidate.email && candidate.email.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesLocation = locationFilter === 'all' || 
      (candidate.location_country && candidate.location_country.toLowerCase().includes(locationFilter.toLowerCase())) ||
      (candidate.location_city && candidate.location_city.toLowerCase().includes(locationFilter.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' || candidate.status === statusFilter

    const matchesSkills = skillsFilter === 'all' || 
      (candidate.skills && candidate.skills.includes(skillsFilter))
    
    return matchesSearch && matchesLocation && matchesStatus && matchesSkills
  })

// Calculate pagination
const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage)
const startIndex = (currentPage - 1) * itemsPerPage
const endIndex = startIndex + itemsPerPage
const paginatedCandidates = filteredCandidates.slice(startIndex, endIndex)

// Reset pagination when filters change
useEffect(() => {
  setCurrentPage(1)
}, [searchTerm, locationFilter, statusFilter, skillsFilter])

// Selection helpers
const isAllCurrentPageSelected = useMemo(() => {
  const currentPageIds = paginatedCandidates.map(c => c.id)
  return currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.includes(id))
}, [paginatedCandidates, selectedIds])

const toggleSelectionMode = () => {
  setSelectionMode(prev => {
    const next = !prev
    if (!next) setSelectedIds([])
    return next
  })
}

const toggleSelectAllCurrentPage = () => {
  const currentPageIds = paginatedCandidates.map(c => c.id)
  if (isAllCurrentPageSelected) {
    setSelectedIds(ids => ids.filter(id => !currentPageIds.includes(id)))
  } else {
    setSelectedIds(ids => Array.from(new Set([...ids, ...currentPageIds])))
  }
}

const toggleSelect = (id: string) => {
  setSelectedIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])
}

const clearSelection = () => setSelectedIds([])

const archiveSelected = async () => {
  if (selectedIds.length === 0) return
  try {
    const { error } = await supabase
      .from('candidates')
      .update({ status: 'inactive' })
      .in('id', selectedIds)
    if (error) throw error
    toast({ title: 'Archived', description: `${selectedIds.length} candidate(s) archived.` })
    clearSelection()
    setSelectionMode(false)
    onRefresh?.()
  } catch (e) {
    console.error(e)
    toast({ title: 'Error', description: 'Failed to archive candidates.', variant: 'destructive' })
  }
}

// Generate page numbers for pagination
const getPageNumbers = () => {
  const pages: (number | 'ellipsis')[] = []
  
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
  } else {
    pages.push(1)
    
    if (currentPage > 4) {
      pages.push('ellipsis')
    }
    
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)
    
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    
    if (currentPage < totalPages - 3) {
      pages.push('ellipsis')
    }
    
    if (totalPages > 1) {
      pages.push(totalPages)
    }
  }
  
  return pages
}

  if (isLoading) {
    return (
      <Card className="bg-surface-primary border-border">
        <CardHeader>
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-md">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[52px] bg-surface-secondary rounded-brand animate-pulse" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-surface-primary border-border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search candidates by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="MX">Mexico</SelectItem>
              <SelectItem value="CA">Canada</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="interviewing">Interviewing</SelectItem>
              <SelectItem value="hired">Hired</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={skillsFilter} onValueChange={setSkillsFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Skills" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Skills</SelectItem>
              {uniqueSkills.map((skill) => (
                <SelectItem key={skill} value={skill}>{skill}</SelectItem>
              ))}
            </SelectContent>
          </Select>

<PermissionGate permission="canManageCandidates">
  <div className="ml-auto flex items-center gap-2">
    {!selectionMode && (
      <Button onClick={onAddNew} size="sm" className="gap-sm h-[40px]">
        <UserPlus className="h-4 w-4" />
        Add Candidate
      </Button>
    )}
    <Button onClick={toggleSelectionMode} variant={selectionMode ? 'secondary' : 'outline'} size="sm" className="gap-2 h-[40px]">
      <ListChecks className="h-4 w-4" />
      {selectionMode ? 'Done' : 'Select'}
    </Button>
  </div>
</PermissionGate>

        </div>
</CardHeader>
<CardContent>
  {/* Bulk actions toolbar */}
  {selectionMode && selectedIds.length > 0 && (
    <div className="flex items-center justify-between mb-4">
      <div className="text-sm text-text-secondary">
        {selectedIds.length} selected
      </div>
      <div className="flex items-center gap-2">
        <BulkAddToJobPipelineDialog candidateIds={selectedIds} onCompleted={() => { onRefresh?.(); clearSelection(); setSelectionMode(false) }} />
        <Button variant="outline" className="gap-2" onClick={archiveSelected}>
          <Archive className="h-4 w-4" />
          Archive
        </Button>
      </div>
    </div>
  )}
  {filteredCandidates.length === 0 ? (

          <div className="text-center py-xl bg-surface-secondary rounded-brand border border-border/50">
            <FileText className="h-12 w-12 mx-auto mb-md text-text-secondary opacity-50" />
            <p className="text-md font-medium text-text-primary mb-sm">
              {candidates.length === 0 ? 'No candidates yet' : 'No candidates match your filters'}
            </p>
            <p className="text-sm text-text-secondary">
              {candidates.length === 0 ? 'Add your first candidate to the database' : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-sm">
              {/* Desktop Table View */}
              <div className="hidden md:block">
<Table>
  <TableHeader>
    <TableRow>
      {selectionMode && (
        <TableHead className="w-10">
          <Checkbox
            checked={isAllCurrentPageSelected}
            onCheckedChange={toggleSelectAllCurrentPage}
            aria-label="Select all on page"
          />
        </TableHead>
      )}
      <TableHead>Name</TableHead>
      <TableHead>Contact</TableHead>
      <TableHead>Location</TableHead>
      <TableHead>Salary Expectations</TableHead>
      <TableHead>Skills</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Added</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
{paginatedCandidates.map((candidate) => (
  <TableRow 
    key={candidate.id}
    interactive
    className="cursor-pointer"
    onClick={() => !selectionMode && handleViewProfile(candidate.id)}
  >
    {selectionMode && (
      <TableCell onClick={(e) => e.stopPropagation()} className="w-10">
        <Checkbox
          checked={selectedIds.includes(candidate.id)}
          onCheckedChange={() => toggleSelect(candidate.id)}
          aria-label={`Select ${candidate.candidate_name}`}
        />
      </TableCell>
    )}
    <TableCell>
      <div className="font-medium text-text-primary">
        {candidate.candidate_name}
      </div>
      {candidate.linkedin_url && (
        <a 
          href={candidate.linkedin_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          LinkedIn <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {candidate.email && (
                              <div className="flex items-center gap-1 text-sm text-text-secondary">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span>{candidate.email}</span>
                              </div>
                            )}
                            {candidate.phone && (
                              <div className="flex items-center gap-1 text-sm text-text-secondary">
                                <Phone className="h-3 w-3 shrink-0" />
                                <span>{candidate.phone}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-text-secondary">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>{formatLocation(candidate)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-text-secondary">
                            <DollarSign className="h-3 w-3 shrink-0" />
                            <span>{formatSalary(candidate)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {candidate.skills?.slice(0, 3).map((skill) => (
                              <Badge key={skill} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {candidate.skills && candidate.skills.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{candidate.skills.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${getStatusColor(candidate.status)}`}>
                            {candidate.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-text-secondary">
                            {new Date(candidate.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <PermissionGate permission="canManageCandidates">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleDelete(candidate.id)
                                }}
                                className="h-[36px] w-[36px] p-0 text-destructive hover:bg-destructive/10 hover:scale-110 transition-all duration-150"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-sm">
                {paginatedCandidates.map((candidate) => (
                  <Card key={candidate.id} className="bg-background border-border hover:shadow-sm transition-all duration-150">
                    <CardContent className="p-sm">
                      <div 
                        className="cursor-pointer"
                        onClick={() => handleViewProfile(candidate.id)}
                      >
                        <div className="space-y-sm">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-text-primary">
                                {candidate.candidate_name}
                              </h4>
                              <Badge className={`text-xs ${getStatusColor(candidate.status)} mt-1`}>
                                {candidate.status}
                              </Badge>
                              <div className="flex items-center gap-1 text-sm text-text-secondary mt-1">
                                <MapPin className="h-3 w-3" />
                                {formatLocation(candidate)}
                              </div>
                            </div>
                            <PermissionGate permission="canManageCandidates">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleDelete(candidate.id)
                                }}
                                className="h-[40px] w-[40px] p-0 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                          </div>

                          <div className="flex items-center gap-1 text-sm text-text-secondary">
                            <DollarSign className="h-3 w-3" />
                            {formatSalary(candidate)}
                          </div>

                          {candidate.skills && candidate.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {candidate.skills.slice(0, 2).map((skill) => (
                                <Badge key={skill} variant="outline" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                              {candidate.skills.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{candidate.skills.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 space-y-6">
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-secondary/50 border border-border/50 rounded-brand text-sm text-text-secondary backdrop-blur-sm">
                    <FileText className="h-4 w-4 opacity-60" />
                    <span className="font-medium">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredCandidates.length)} of {filteredCandidates.length} candidates
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <div className="inline-flex items-center bg-surface-primary border border-border/80 rounded-brand shadow-sm p-1 gap-1">
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
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}