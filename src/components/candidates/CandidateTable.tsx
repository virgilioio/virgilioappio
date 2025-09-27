
import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, UserPlus, MapPin, DollarSign, FileText, Search, ChevronLeft, ChevronRight, MoreHorizontal, ListChecks, Archive, Clock } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { usePermissions } from '@/hooks/usePermissions'
import { NewBadge } from '@/components/ui/new-badge'
import { getSkillColor } from '@/utils/skillColors'
import BulkMoveJobCandidatesToPipelineDialog from '@/components/candidates/BulkMoveJobCandidatesToPipelineDialog'

// Support both local job candidates and global candidates with job info
interface BaseCandidate {
  id: string
  candidate_name: string
  location_country: string | null
  location_state: string | null
  location_city: string | null
  salary_amount: number | null
  salary_currency: string | null
  salary_period: string | null
  profile_summary: string | null
  skills: string[] | null
  created_at: string
  first_viewed_by: Record<string, string> | null
  match_score?: number
  match_tier?: 'excellent' | 'good' | 'fair' | 'minimal'
}

interface LocalCandidate extends BaseCandidate {
  job_id: string
  notes: string | null
  added_by: string | null
  updated_at: string
}

interface GlobalCandidate extends BaseCandidate {
  job: {
    id: string
    title: string
    organization: {
      name: string
    }
  }
}

type CandidateTableCandidate = LocalCandidate | GlobalCandidate

interface CandidateTableProps {
  candidates: CandidateTableCandidate[]
  isLoading: boolean
  onEdit: (candidate: CandidateTableCandidate) => void
  onDelete: (candidateId: string) => void
  onAddNew?: () => void
  markCandidateAsViewed: (candidateId: string) => void
  isCandidateNewForUser: (candidate: CandidateTableCandidate) => boolean
  showJobInfo?: boolean // Whether to show job/organization columns
  onRowClick?: (candidateId: string) => void
  selectionMode?: boolean
  onSelectionModeChange?: (mode: boolean) => void
  selectedIds?: string[]
  onSelectedIdsChange?: (ids: string[])=> void
  hideActions?: boolean // Hide action buttons for suggested candidates
  showMatchScore?: boolean // Show match score column for AI suggestions
}

export function CandidateTable({ 
  candidates, 
  isLoading, 
  onEdit, 
  onDelete, 
  onAddNew, 
  markCandidateAsViewed,
  isCandidateNewForUser,
  showJobInfo = false,
  onRowClick,
  selectionMode: controlledSelectionMode,
  onSelectionModeChange,
  selectedIds: controlledSelectedIds,
  onSelectedIdsChange,
  hideActions = false,
  showMatchScore = false
}: CandidateTableProps) {
  const { id: jobId } = useParams<{ id: string }>()
  const permissions = usePermissions()
  const [searchTerm, setSearchTerm] = useState('')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Selection state (controlled or uncontrolled)
  const [internalSelectionMode, setInternalSelectionMode] = useState(false)
  const selectionMode = (typeof controlledSelectionMode === 'boolean') ? controlledSelectionMode : internalSelectionMode
  const setSelectionMode = onSelectionModeChange ?? setInternalSelectionMode
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([])
  const selectedIds = controlledSelectedIds ?? internalSelectedIds
  const setSelectedIds = onSelectedIdsChange ?? setInternalSelectedIds

  const handleDelete = (candidateId: string) => {
    if (confirm('Are you sure you want to delete this candidate?')) {
      onDelete(candidateId)
    }
  }

  const handleCandidateClick = (candidate: CandidateTableCandidate) => {
    markCandidateAsViewed(candidate.id)
  }

  const handleLinkClick = (e: React.MouseEvent, candidate: CandidateTableCandidate) => {
    if (onRowClick) {
      e.preventDefault()
      e.stopPropagation()
      onRowClick(candidate.id)
    } else {
      handleCandidateClick(candidate)
    }
  }


  const getCandidateLink = (candidate: CandidateTableCandidate) => {
    if ('job' in candidate) {
      // Global candidate with job info
      return `/jobs/${candidate.job.id}/candidates/${candidate.id}`
    } else {
      // Independent candidate (no job context) -> open independent profile
      return `/candidates/${candidate.id}`
    }
  }

  // Filter logic
  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch = candidate.candidate_name.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

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
  const pagedIds = useMemo(() => paginatedCandidates.map(c => c.id), [paginatedCandidates])
  const isAllCurrentPageSelected = useMemo(() => pagedIds.length > 0 && pagedIds.every(id => selectedIds.includes(id)), [pagedIds, selectedIds])
  const toggleSelectionMode = () => {
    const next = !selectionMode
    setSelectionMode(next)
    if (!next) setSelectedIds([])
  }
  const toggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      const newIds = selectedIds.filter(id => !pagedIds.includes(id))
      setSelectedIds(newIds)
    } else {
      const newIds = Array.from(new Set([...selectedIds, ...pagedIds]))
      setSelectedIds(newIds)
    }
  }
  const toggleSelect = (id: string) => {
    const newIds = selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]
    setSelectedIds(newIds)
  }
  const clearSelection = () => setSelectedIds([])
  useEffect(() => { if (!selectionMode) setSelectedIds([]) }, [selectionMode, setSelectedIds])
  const archiveSelected = async () => {
    if (selectedIds.length === 0) return
    await Promise.allSettled(selectedIds.map(id => Promise.resolve(onDelete(id))))
    clearSelection(); setSelectionMode(false)
  }

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
              placeholder="Search candidates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          

          <PermissionGate permission="canManageCandidates">
            <div className="ml-auto flex items-center gap-2">
              {!selectionMode && onAddNew && (
                <Button onClick={onAddNew} size="sm" className="gap-sm h-[40px]">
                  <UserPlus className="h-4 w-4" />
                  Add Candidate
                </Button>
              )}
              {!onSelectionModeChange && (
                <Button onClick={toggleSelectionMode} variant={selectionMode ? 'secondary' : 'outline'} size="sm" className="gap-2 h-[40px]">
                  <ListChecks className="h-4 w-4" />
                  {selectionMode ? 'Done' : 'Select'}
                </Button>
              )}
            </div>
          </PermissionGate>
        </div>
      </CardHeader>
      <CardContent>
        {/* Bulk actions are now handled in the Pipeline Overview header */}
        {filteredCandidates.length === 0 ? (
          <EmptyState
            assetType="empty-state-candidates"
            title={candidates.length === 0 ? 'No candidates yet' : 'No candidates match your filters'}
            description={candidates.length === 0 ? 'Add your first candidate to this job' : 'Try adjusting your search or filters'}
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
                         {showMatchScore && <TableHead>Match</TableHead>}
                         {showJobInfo && <TableHead>Job</TableHead>}
                         {showJobInfo && <TableHead>Organization</TableHead>}
                         <TableHead>Skills</TableHead>
                         <TableHead>Added</TableHead>
                        {!hideActions && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCandidates.map((candidate) => (
                      <TableRow 
                        key={candidate.id}
                        interactive
                        className="cursor-pointer"
                      >
                        {selectionMode && (
                          <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.includes(candidate.id)}
                              onCheckedChange={() => toggleSelect(candidate.id)}
                              aria-label={`Select ${candidate.candidate_name}`}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <Link 
                          to={getCandidateLink(candidate)}
                          className="block w-full h-full"
                          onClick={(e) => handleLinkClick(e, candidate)}
                          >
                            <div className="font-medium text-text-primary flex items-center">
                              {candidate.candidate_name}
                              <NewBadge show={isCandidateNewForUser(candidate)} />
                            </div>
                           </Link>
                         </TableCell>
                         {showMatchScore && (
                           <TableCell>
                             {candidate.match_score !== undefined && (
                               <div className="flex items-center gap-2">
                                 <Badge 
                                   variant={
                                     candidate.match_tier === 'excellent' ? 'default' :
                                     candidate.match_tier === 'good' ? 'secondary' :
                                     candidate.match_tier === 'fair' ? 'outline' : 'destructive'
                                   }
                                   className={
                                     candidate.match_tier === 'excellent' ? 'bg-green-500 text-white' :
                                     candidate.match_tier === 'good' ? 'bg-blue-500 text-white' :
                                     candidate.match_tier === 'fair' ? 'bg-yellow-500 text-white' :
                                     'bg-orange-500 text-white'
                                   }
                                 >
                                   {Math.round(candidate.match_score)}%
                                 </Badge>
                                 <span className="text-xs text-text-tertiary capitalize">
                                   {candidate.match_tier}
                                 </span>
                               </div>
                             )}
                           </TableCell>
                         )}
                        {showJobInfo && 'job' in candidate && (
                          <TableCell>
                            <Link 
                               to={getCandidateLink(candidate)}
                               className="block w-full h-full"
                               onClick={(e) => handleLinkClick(e, candidate)}
                            >
                              <div className="text-sm text-text-secondary">
                                {candidate.job.title}
                              </div>
                            </Link>
                          </TableCell>
                        )}
                        {showJobInfo && 'job' in candidate && (
                          <TableCell>
                            <Link 
                               to={getCandidateLink(candidate)}
                               className="block w-full h-full"
                               onClick={(e) => handleLinkClick(e, candidate)}
                            >
                              <div className="text-sm text-text-secondary">
                                {candidate.job.organization.name}
                              </div>
                            </Link>
                          </TableCell>
                          )}
                          <TableCell>
                            {(() => {
                              // Get skills from various sources
                              const skillsArray = candidate.skills || []
                              const autoGenerated = Array.isArray((candidate as any)?.auto_generated_skills)
                                ? ((candidate as any).auto_generated_skills as any[]).map((s) => typeof s === 'string' ? s : s?.name).filter(Boolean)
                                : []
                              
                              // Use manual skills if available, otherwise use auto-generated
                              const displaySkills = skillsArray.length > 0 ? skillsArray : autoGenerated
                              
                              return displaySkills && displaySkills.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {displaySkills.slice(0, 3).map((skill, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="secondary"
                                      className={`text-xs py-0 px-1 h-5 ${getSkillColor(skill)}`}
                                    >
                                      {skill}
                                    </Badge>
                                  ))}
                                  {displaySkills.length > 3 && (
                                    <Badge variant="outline" className="text-xs py-0 px-1 h-5">
                                      +{displaySkills.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-text-secondary">No skills</span>
                              )
                            })()}
                          </TableCell>
                        <TableCell>
                          <Link 
                             to={getCandidateLink(candidate)}
                             className="block w-full h-full"
                             onClick={(e) => handleLinkClick(e, candidate)}
                          >
                            <div className="text-sm text-text-secondary">
                              {new Date(candidate.created_at).toLocaleDateString()}
                            </div>
                          </Link>
                        </TableCell>
                         {!hideActions && (
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
                         )}
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
                      <Link 
                        to={getCandidateLink(candidate)} 
                        className="block"
                        onClick={(e) => handleLinkClick(e, candidate)}
                      >
                        <div className="space-y-sm">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-text-primary flex items-center">
                                {candidate.candidate_name}
                                <NewBadge show={isCandidateNewForUser(candidate)} />
                              </h4>
                              {showJobInfo && 'job' in candidate && (
                               <div className="text-sm text-text-secondary mt-1">
                                 {candidate.job.title} at {candidate.job.organization.name}
                               </div>
                             )}
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

                          <div className="flex items-center gap-2 text-text-secondary mt-2">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">Added {new Date(candidate.created_at).toLocaleDateString()}</span>
                          </div>
                          
                          <div className="mt-3">
                            <div className="text-sm font-medium text-text-primary mb-2">Skills:</div>
                            {(() => {
                              // Get skills from various sources
                              const skillsArray = candidate.skills || []
                              const autoGenerated = Array.isArray((candidate as any)?.auto_generated_skills)
                                ? ((candidate as any).auto_generated_skills as any[]).map((s) => typeof s === 'string' ? s : s?.name).filter(Boolean)
                                : []
                              
                              // Use manual skills if available, otherwise use auto-generated
                              const displaySkills = skillsArray.length > 0 ? skillsArray : autoGenerated
                              
                              return displaySkills && displaySkills.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {displaySkills.map((skill, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="secondary"
                                      className={`text-xs ${getSkillColor(skill)}`}
                                    >
                                      {skill}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-sm text-text-secondary">No skills specified</span>
                              )
                            })()}
                          </div>
                         </div>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Beautiful Enhanced Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 space-y-6">
                {/* Results Summary Card */}
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-secondary/50 border border-border/50 rounded-brand text-sm text-text-secondary backdrop-blur-sm">
                    <FileText className="h-4 w-4 opacity-60" />
                    <span className="font-medium">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredCandidates.length)} of {filteredCandidates.length} candidates
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
