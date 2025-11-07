import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, UserPlus, MapPin, DollarSign, FileText, Search, ChevronLeft, ChevronRight, MoreHorizontal, Mail, Phone, ExternalLink, ListChecks, Archive } from 'lucide-react'
import { PermissionGate } from '@/components/auth/PermissionGate'

import { IndependentCandidate } from '@/hooks/useIndependentCandidates'
import BulkAddToJobPipelineDialog from '@/components/candidates/BulkAddToJobPipelineDialog'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import UniversalCandidateProfileSheet from '@/components/candidates/UniversalCandidateProfileSheet'

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
  
  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  
  // Job association counts
  const [jobCounts, setJobCounts] = useState<Record<string, number>>({})

  // Sheet state
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleViewProfile = (candidateId: string) => {
    if (!selectionMode) {
      setSelectedCandidateId(candidateId)
      setSheetOpen(true)
    }
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

  const getRelativeTime = (dateString: string) => {
    const now = new Date()
    const added = new Date(dateString)
    const diffMs = now.getTime() - added.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays < 30) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      return `${months} month${months !== 1 ? 's' : ''} ago`
    } else {
      const years = (diffDays / 365).toFixed(1)
      return `${years} year${parseFloat(years) !== 1 ? 's' : ''} ago`
    }
  }

  // Filter logic
  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch = candidate.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (candidate.email && candidate.email.toLowerCase().includes(searchTerm.toLowerCase()))
    
    return matchesSearch
  })
  
  // Fetch job association counts
  useEffect(() => {
    const fetchJobCounts = async () => {
      if (candidates.length === 0) return
      
      const candidateIds = candidates.map(c => c.id)
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select('candidate_id')
        .in('candidate_id', candidateIds)
        .eq('status', 'active')
      
      if (!error && data) {
        const counts = data.reduce((acc, item) => {
          acc[item.candidate_id] = (acc[item.candidate_id] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        setJobCounts(counts)
      }
    }
    
    fetchJobCounts()
  }, [candidates])

// Calculate pagination
const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage)
const startIndex = (currentPage - 1) * itemsPerPage
const endIndex = startIndex + itemsPerPage
const paginatedCandidates = filteredCandidates.slice(startIndex, endIndex)

// Reset pagination when filters change
useEffect(() => {
  setCurrentPage(1)
}, [searchTerm])

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

          <EmptyState
            assetType="empty-state-independent-candidates"
            title={candidates.length === 0 ? 'No candidates yet' : 'No candidates match your filters'}
            description={candidates.length === 0 ? 'Add your first candidate to the database' : 'Try adjusting your search or filters'}
            fallbackIcon={FileText}
          />
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
      <TableHead>In Jobs</TableHead>
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
                          <div className="text-sm text-text-secondary">
                            {jobCounts[candidate.id] || 0}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-text-secondary">
                            {getRelativeTime(candidate.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <PermissionGate permission="canDeleteCandidates">
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
                            <div className="space-y-1">
                              <h4 className="font-medium text-text-primary">
                                {candidate.candidate_name}
                              </h4>
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
                            </div>
                            <PermissionGate permission="canDeleteCandidates">
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

                          <div className="flex items-center gap-4 text-sm text-text-secondary">
                            <div>In {jobCounts[candidate.id] || 0} job{(jobCounts[candidate.id] || 0) !== 1 ? 's' : ''}</div>
                            <div>•</div>
                            <div>{getRelativeTime(candidate.created_at)}</div>
                          </div>
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

      {/* Universal Candidate Profile Sheet */}
      <UniversalCandidateProfileSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        candidateId={selectedCandidateId}
        context="independent"
        hasPrev={(() => {
          if (!selectedCandidateId) return false
          const currentIndex = filteredCandidates.findIndex(c => c.id === selectedCandidateId)
          return currentIndex > 0
        })()}
        hasNext={(() => {
          if (!selectedCandidateId) return false
          const currentIndex = filteredCandidates.findIndex(c => c.id === selectedCandidateId)
          return currentIndex >= 0 && currentIndex < filteredCandidates.length - 1
        })()}
        onNavigatePrev={() => {
          if (!selectedCandidateId) return
          const currentIndex = filteredCandidates.findIndex(c => c.id === selectedCandidateId)
          if (currentIndex > 0) {
            setSelectedCandidateId(filteredCandidates[currentIndex - 1].id)
          }
        }}
        onNavigateNext={() => {
          if (!selectedCandidateId) return
          const currentIndex = filteredCandidates.findIndex(c => c.id === selectedCandidateId)
          if (currentIndex >= 0 && currentIndex < filteredCandidates.length - 1) {
            setSelectedCandidateId(filteredCandidates[currentIndex + 1].id)
          }
        }}
      />
    </Card>
  )
}