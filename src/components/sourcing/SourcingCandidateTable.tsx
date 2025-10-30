import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Plus, CheckCircle2, Loader2, MapPin, Linkedin, ChevronLeft, ChevronRight } from 'lucide-react'
import emptyStateAvatar from '@/assets/empty-state-avatar.png'
import UniversalCandidateProfileSheet from '@/components/candidates/UniversalCandidateProfileSheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SortableHeader } from '@/components/ui/sortable-header'
import { useSortableTable } from '@/hooks/useSortableTable'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'

interface MatchedCandidate {
  id: string
  candidate_name: string
  current_role?: string
  current_company?: string
  location_city?: string
  location_country?: string
  linkedin_url?: string
  match_score: number
  match_tier: 'excellent' | 'good' | 'fair' | 'minimal'
  skills?: string[]
  years_experience?: number
}

interface SourcingCandidateTableProps {
  candidates: MatchedCandidate[]
  isLoading: boolean
  jobId?: string | null
}

export function SourcingCandidateTable({ 
  candidates, 
  isLoading,
  jobId
}: SourcingCandidateTableProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  
  // Sortable table with default sort by match_score DESC
  const { sortedData, sortConfig, requestSort } = useSortableTable(
    candidates,
    { key: 'match_score', direction: 'desc' }
  )

  // Track which candidates are already in pipeline
  const [addedCandidates, setAddedCandidates] = useState<Set<string>>(new Set())
  const [loadingCandidates, setLoadingCandidates] = useState<Set<string>>(new Set())

  // Check existing pipeline candidates
  useEffect(() => {
    if (!jobId || candidates.length === 0) return

    const checkExisting = async () => {
      const { data } = await supabase
        .from('job_candidate_associations')
        .select('candidate_id')
        .eq('job_id', jobId)
        .in('candidate_id', candidates.map(c => c.id))

      if (data) {
        setAddedCandidates(new Set(data.map(d => d.candidate_id)))
      }
    }

    checkExisting()
  }, [jobId, candidates])

  const handleAddToPipeline = async (candidate: MatchedCandidate, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!jobId) {
      toast({
        title: 'No job linked',
        description: 'This project is not linked to a job yet.',
        variant: 'destructive'
      })
      return
    }

    setLoadingCandidates(prev => new Set(prev).add(candidate.id))

    try {
      const { error } = await supabase
        .from('job_candidate_associations')
        .insert({
          job_id: jobId,
          candidate_id: candidate.id,
          stage: 'sourced'
        })

      if (error) throw error

      setAddedCandidates(prev => new Set(prev).add(candidate.id))
      toast({
        title: 'Added to pipeline',
        description: `${candidate.candidate_name} has been added.`
      })
    } catch (error: any) {
      toast({
        title: 'Failed to add candidate',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoadingCandidates(prev => {
        const next = new Set(prev)
        next.delete(candidate.id)
        return next
      })
    }
  }

  const getMatchBadgeColor = (tier: string) => {
    switch (tier) {
      case 'excellent': return 'bg-green-500 text-white hover:bg-green-600'
      case 'good': return 'bg-blue-500 text-white hover:bg-blue-600'
      case 'fair': return 'bg-yellow-500 text-white hover:bg-yellow-600'
      case 'minimal': return 'bg-orange-500 text-white hover:bg-orange-600'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage)

  if (isLoading) {
    return (
      <Card className="shadow-calendly">
        <CardContent className="p-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (candidates.length === 0) {
    return (
      <Card className="shadow-calendly">
        <CardContent className="p-12 text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <img 
                src={emptyStateAvatar} 
                alt="No candidates found"
                className="h-24 w-24 rounded-full"
              />
            </div>
            <h3 className="text-lg font-semibold">No candidates found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search criteria or filters
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table View */}
      <Card className="shadow-calendly hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">
                  <SortableHeader 
                    sortKey="candidate_name" 
                    currentSort={sortConfig} 
                    onSort={requestSort}
                  >
                    Name
                  </SortableHeader>
                </TableHead>
                <TableHead className="w-[120px]">
                  <SortableHeader 
                    sortKey="match_score" 
                    currentSort={sortConfig} 
                    onSort={requestSort}
                  >
                    Match
                  </SortableHeader>
                </TableHead>
                <TableHead className="w-[200px]">
                  <SortableHeader 
                    sortKey="current_role" 
                    currentSort={sortConfig} 
                    onSort={requestSort}
                  >
                    Current Role
                  </SortableHeader>
                </TableHead>
                <TableHead className="w-[150px]">
                  <SortableHeader 
                    sortKey="location_country" 
                    currentSort={sortConfig} 
                    onSort={requestSort}
                  >
                    Location
                  </SortableHeader>
                </TableHead>
                <TableHead>Skills</TableHead>
                <TableHead className="w-[100px]">
                  <SortableHeader 
                    sortKey="years_experience" 
                    currentSort={sortConfig} 
                    onSort={requestSort}
                  >
                    Experience
                  </SortableHeader>
                </TableHead>
                <TableHead className="text-right w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map(candidate => {
                const isAdded = addedCandidates.has(candidate.id)
                const isLoading = loadingCandidates.has(candidate.id)

                return (
                  <TableRow 
                    key={candidate.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedCandidateId(candidate.id)
                      setSheetOpen(true)
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-accent/20 text-accent-foreground font-semibold text-xs">
                            {candidate.candidate_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{candidate.candidate_name}</span>
                          {candidate.linkedin_url && (
                            <a 
                              href={candidate.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Linkedin className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs font-semibold", getMatchBadgeColor(candidate.match_tier))}>
                        {candidate.match_score}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium truncate">{candidate.current_role || '-'}</div>
                        {candidate.current_company && (
                          <div className="text-xs text-muted-foreground truncate">{candidate.current_company}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        {candidate.location_city ? (
                          <>
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate">{candidate.location_city}, {candidate.location_country}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {candidate.skills && candidate.skills.length > 0 ? (
                          <>
                            {candidate.skills.slice(0, 3).map(skill => (
                              <Badge key={skill} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {candidate.skills.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{candidate.skills.length - 3}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {candidate.years_experience ? `${candidate.years_experience} yrs` : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedCandidateId(candidate.id)
                            setSheetOpen(true)
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        
                        {isAdded ? (
                          <Button 
                            size="sm" 
                            variant="secondary"
                            disabled
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Added
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="default"
                            onClick={(e) => handleAddToPipeline(candidate, e)}
                            disabled={isLoading || !jobId}
                          >
                            {isLoading ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Plus className="h-3 w-3 mr-1" />
                            )}
                            Add
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedData.length)} of {sortedData.length} candidates
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {paginatedData.map(candidate => {
          const isAdded = addedCandidates.has(candidate.id)
          const isLoading = loadingCandidates.has(candidate.id)

          return (
            <Card 
              key={candidate.id} 
              className="shadow-calendly cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => {
                setSelectedCandidateId(candidate.id)
                setSheetOpen(true)
              }}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-accent/20 text-accent-foreground font-semibold text-sm">
                      {candidate.candidate_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm">{candidate.candidate_name}</h3>
                      <Badge className={cn("text-xs", getMatchBadgeColor(candidate.match_tier))}>
                        {candidate.match_score}%
                      </Badge>
                    </div>
                    {candidate.current_role && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {candidate.current_role}
                        {candidate.current_company && ` @ ${candidate.current_company}`}
                      </p>
                    )}
                    {candidate.location_city && (
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {candidate.location_city}, {candidate.location_country}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {candidate.skills && candidate.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {candidate.skills.slice(0, 3).map(skill => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {candidate.skills.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{candidate.skills.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedCandidateId(candidate.id)
                      setSheetOpen(true)
                    }}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  
                  {isAdded ? (
                    <Button 
                      size="sm" 
                      variant="secondary"
                      className="flex-1"
                      disabled
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Added
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="default"
                      className="flex-1"
                      onClick={(e) => handleAddToPipeline(candidate, e)}
                      disabled={isLoading || !jobId}
                    >
                      {isLoading ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3 mr-1" />
                      )}
                      Add
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Universal Candidate Profile Sheet */}
      <UniversalCandidateProfileSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        candidateId={selectedCandidateId}
        jobId={jobId}
        context="sourcing"
      />
    </div>
  )
}
