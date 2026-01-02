import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Plus, CheckCircle2, Loader2, MapPin, Linkedin, ChevronLeft, ChevronRight, Download, Mail, Phone } from 'lucide-react'
import { useSourcingCreditWarnings } from '@/hooks/useSourcingCreditWarnings'
import emptyStateAvatar from '@/assets/empty-state-avatar.png'
import UniversalCandidateProfileSheet from '@/components/candidates/UniversalCandidateProfileSheet'
import { CandidateTableSkeleton } from './CandidateTableSkeleton'
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
  location?: string  // Full location string (only available after enrichment)
  location_city?: string
  location_state?: string
  location_country?: string
  linkedin_url?: string  // Only available after enrichment
  match_score: number
  match_tier: 'excellent' | 'good' | 'fair' | 'minimal'
  skills?: string[]
  years_experience?: number
  source: 'local' | 'apollo'
  apollo_id?: string
  apollo_score?: number
  headline?: string
  email?: string
  email_status?: string
  phone?: string
  candidate_id?: string | null
  industry?: string
  connections_count?: number
  follower_count?: number
  company_url?: string
  company_website?: string
  company_industry?: string
  experience_location?: string
  // Apollo availability indicators (indicate what CAN be revealed after collection)
  has_email?: boolean
  has_phone?: boolean
  has_location?: boolean  // Indicates location is available after enrichment
}

interface SourcingCandidateTableProps {
  candidates: MatchedCandidate[]
  isLoading: boolean
  jobId?: string | null
  searchCriteria?: import('@/types/sourcing').SearchCriteria
}

export function SourcingCandidateTable({ 
  candidates, 
  isLoading,
  jobId,
  searchCriteria
}: SourcingCandidateTableProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [selectedApolloId, setSelectedApolloId] = useState<string | null>(null)
  const [selectedApolloData, setSelectedApolloData] = useState<any>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { isCollectDisabled } = useSourcingCreditWarnings()
  
  // Sortable table with default sort by match_score DESC
  const { sortedData, sortConfig, requestSort } = useSortableTable(
    candidates,
    { key: 'match_score', direction: 'desc' }
  )

  // Track current candidate index for navigation
  const currentIndex = selectedApolloId 
    ? sortedData.findIndex(c => c.apollo_id === selectedApolloId)
    : sortedData.findIndex(c => c.id === selectedCandidateId)
  
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < sortedData.length - 1

  // Navigation handlers
  const handleNavigatePrev = () => {
    if (currentIndex > 0) {
      const prevCandidate = sortedData[currentIndex - 1]
      
      if (prevCandidate.candidate_id || prevCandidate.source === 'local') {
        setSelectedCandidateId(prevCandidate.id)
        setSelectedApolloId(null)
        setSelectedApolloData(null)
      } else if (prevCandidate.source === 'apollo' && prevCandidate.apollo_id) {
        setSelectedCandidateId(null)
        setSelectedApolloId(prevCandidate.apollo_id)
        setSelectedApolloData({
          candidate_name: prevCandidate.candidate_name,
          headline: prevCandidate.headline,
          location: prevCandidate.location || (prevCandidate.location_city ? `${prevCandidate.location_city}, ${prevCandidate.location_country}` : prevCandidate.location_country),
          current_company: prevCandidate.current_company,
          current_role: prevCandidate.current_role,
          linkedin_url: prevCandidate.linkedin_url,
          apollo_score: prevCandidate.apollo_score,
          email: prevCandidate.email,
          phone: prevCandidate.phone,
          industry: prevCandidate.industry,
          connections_count: prevCandidate.connections_count,
          follower_count: prevCandidate.follower_count,
          company_url: prevCandidate.company_url,
          company_website: prevCandidate.company_website,
          company_industry: prevCandidate.company_industry,
          experience_location: prevCandidate.experience_location,
          // Availability flags
          has_email: prevCandidate.has_email,
          has_phone: prevCandidate.has_phone,
          has_location: prevCandidate.has_location
        })
      }
      
      // Update pagination if needed
      const prevPage = Math.floor((currentIndex - 1) / itemsPerPage) + 1
      if (prevPage !== currentPage) {
        setCurrentPage(prevPage)
      }
    }
  }

  const handleNavigateNext = () => {
    if (currentIndex < sortedData.length - 1) {
      const nextCandidate = sortedData[currentIndex + 1]
      
      if (nextCandidate.candidate_id || nextCandidate.source === 'local') {
        setSelectedCandidateId(nextCandidate.id)
        setSelectedApolloId(null)
        setSelectedApolloData(null)
      } else if (nextCandidate.source === 'apollo' && nextCandidate.apollo_id) {
        setSelectedCandidateId(null)
        setSelectedApolloId(nextCandidate.apollo_id)
        setSelectedApolloData({
          candidate_name: nextCandidate.candidate_name,
          headline: nextCandidate.headline,
          location: nextCandidate.location || (nextCandidate.location_city ? `${nextCandidate.location_city}, ${nextCandidate.location_country}` : nextCandidate.location_country),
          current_company: nextCandidate.current_company,
          current_role: nextCandidate.current_role,
          linkedin_url: nextCandidate.linkedin_url,
          apollo_score: nextCandidate.apollo_score,
          email: nextCandidate.email,
          phone: nextCandidate.phone,
          industry: nextCandidate.industry,
          connections_count: nextCandidate.connections_count,
          follower_count: nextCandidate.follower_count,
          company_url: nextCandidate.company_url,
          company_website: nextCandidate.company_website,
          company_industry: nextCandidate.company_industry,
          experience_location: nextCandidate.experience_location,
          // Availability flags
          has_email: nextCandidate.has_email,
          has_phone: nextCandidate.has_phone,
          has_location: nextCandidate.has_location
        })
      }
      
      // Update pagination if needed
      const nextPage = Math.floor((currentIndex + 1) / itemsPerPage) + 1
      if (nextPage !== currentPage) {
        setCurrentPage(nextPage)
      }
    }
  }

  // Track which candidates are already in pipeline
  const [addedCandidates, setAddedCandidates] = useState<Set<string>>(new Set())
  const [loadingCandidates, setLoadingCandidates] = useState<Set<string>>(new Set())
  const [collectingProfiles, setCollectingProfiles] = useState<Set<string>>(new Set())
  // Track apollo IDs that have been collected in this session
  const [collectedApolloIds, setCollectedApolloIds] = useState<Set<string>>(new Set())

  // Handler for when a candidate is collected from the sheet
  const handleCandidateCollected = (candidateId: string, apolloId: string) => {
    setCollectedApolloIds(prev => new Set(prev).add(apolloId))
    setAddedCandidates(prev => new Set(prev).add(candidateId))
  }

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

  const handleCollectProfile = async (apolloId: string) => {
    if (!jobId) {
      toast({
        title: 'No job linked',
        description: 'Cannot collect profile without a job context.',
        variant: 'destructive'
      })
      return
    }

    if (isCollectDisabled) {
      toast({
        title: 'Monthly collect limit reached',
        description: 'You have exhausted your collect credits for this month. Credits will reset on the 1st of next month.',
        variant: 'destructive',
        duration: 8000
      })
      return
    }

    setCollectingProfiles(prev => new Set(prev).add(apolloId))

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase.functions.invoke('enrich-apollo-profile', {
        body: {
          apollo_id: apolloId,
          job_id: jobId,
          user_id: user?.id
        }
      })

      if (error) {
        // Handle credit exhaustion error specifically
        if (error.message?.includes('CREDITS_EXHAUSTED')) {
          throw new Error('Monthly collect credit limit reached. Credits will reset on the 1st of next month.')
        }
        throw error
      }

      toast({
        title: 'Profile collected',
        description: 'Full candidate profile has been added to your pipeline.'
      })

      // Refresh candidates list to show updated data
      window.location.reload()
    } catch (error: any) {
      toast({
        title: 'Failed to collect profile',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setCollectingProfiles(prev => {
        const next = new Set(prev)
        next.delete(apolloId)
        return next
      })
    }
  }

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
    return <CandidateTableSkeleton rows={8} />
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
    <div className="h-full flex flex-col space-y-4">
      {/* Desktop Table View */}
      <Card className="shadow-calendly hidden md:block flex-1 flex flex-col overflow-hidden">
        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">
                  <SortableHeader 
                    sortKey="candidate_name" 
                    currentSort={sortConfig} 
                    onSort={requestSort}
                  >
                    Name
                  </SortableHeader>
                </TableHead>
                <TableHead className="w-[280px]">
                  <SortableHeader 
                    sortKey="current_role" 
                    currentSort={sortConfig} 
                    onSort={requestSort}
                  >
                    Current Role
                  </SortableHeader>
                </TableHead>
                <TableHead>Headline / Skills</TableHead>
                <TableHead className="text-right w-[220px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map(candidate => {
                const isAdded = addedCandidates.has(candidate.id)
                const isLoading = loadingCandidates.has(candidate.id)
                const isCollecting = candidate.apollo_id ? collectingProfiles.has(candidate.apollo_id) : false

                return (
                  <TableRow 
                    key={candidate.apollo_id || candidate.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      if (candidate.candidate_id || candidate.source === 'local') {
                        // Full profile available
                        setSelectedCandidateId(candidate.id)
                        setSelectedApolloId(null)
                        setSelectedApolloData(null)
                        setSheetOpen(true)
                      } else if (candidate.source === 'apollo' && candidate.apollo_id) {
                        // Apollo preview
                        setSelectedCandidateId(null)
                        setSelectedApolloId(candidate.apollo_id)
                        setSelectedApolloData({
                          candidate_name: candidate.candidate_name,
                          headline: candidate.headline,
                          location: candidate.location || (candidate.location_city ? `${candidate.location_city}, ${candidate.location_country}` : candidate.location_country),
                          current_company: candidate.current_company,
                          current_role: candidate.current_role,
                          linkedin_url: candidate.linkedin_url,
                          apollo_score: candidate.apollo_score,
                          email: candidate.email,
                          phone: candidate.phone,
                          industry: candidate.industry,
                          connections_count: candidate.connections_count,
                          follower_count: candidate.follower_count,
                          company_url: candidate.company_url,
                          company_website: candidate.company_website,
                          company_industry: candidate.company_industry,
                          experience_location: candidate.experience_location,
                          // Availability flags
                          has_email: candidate.has_email,
                          has_phone: candidate.has_phone,
                          has_location: candidate.has_location
                        })
                        setSheetOpen(true)
                      }
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-accent/20 text-accent-foreground font-semibold text-xs">
                            {candidate.candidate_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{candidate.candidate_name}</span>
                            {/* Only show LinkedIn icon if URL is available (after enrichment) */}
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
                          {/* Apollo availability indicators - show what CAN be revealed */}
                          {candidate.source === 'apollo' && !candidate.candidate_id && (
                            <div className="flex items-center gap-1.5">
                              {candidate.has_email && (
                                <span className="flex items-center gap-0.5 text-[10px] text-green-600">
                                  <Mail className="h-2.5 w-2.5" />
                                  Email
                                </span>
                              )}
                              {candidate.has_phone && (
                                <span className="flex items-center gap-0.5 text-[10px] text-green-600">
                                  <Phone className="h-2.5 w-2.5" />
                                  Phone
                                </span>
                              )}
                              {candidate.has_location && (
                                <span className="flex items-center gap-0.5 text-[10px] text-green-600">
                                  <MapPin className="h-2.5 w-2.5" />
                                  Location
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
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
                      {candidate.source === 'apollo' && candidate.headline ? (
                        <div className="text-xs text-muted-foreground truncate max-w-[250px]" title={candidate.headline}>
                          {candidate.headline}
                        </div>
                      ) : (
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
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {candidate.source === 'apollo' && !candidate.candidate_id ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCollectProfile(candidate.apollo_id!)
                            }}
                            disabled={isCollecting || isCollectDisabled}
                            title={isCollectDisabled ? 'Monthly collect credit limit reached' : 'Reveal full profile with LinkedIn, email & phone (uses 1 credit)'}
                          >
                            {isCollecting ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3 mr-1" />
                            )}
                            {isCollectDisabled ? 'Credits exhausted' : 'Reveal Profile (1 credit)'}
                          </Button>
                        ) : (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedCandidateId(candidate.id)
                                setSheetOpen(true)
                              }}
                              disabled={!candidate.candidate_id && candidate.source !== 'local'}
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
                                disabled={isLoading || !jobId || (!candidate.candidate_id && candidate.source !== 'local')}
                              >
                                {isLoading ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Plus className="h-3 w-3 mr-1" />
                                )}
                                Add
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0 bg-background">
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
                if (candidate.candidate_id || candidate.source === 'local') {
                  // Full profile available
                  setSelectedCandidateId(candidate.id)
                  setSelectedApolloId(null)
                  setSelectedApolloData(null)
                  setSheetOpen(true)
                } else if (candidate.source === 'apollo' && candidate.apollo_id) {
                  // Apollo preview
                  setSelectedCandidateId(null)
                  setSelectedApolloId(candidate.apollo_id)
                  setSelectedApolloData({
                    candidate_name: candidate.candidate_name,
                    headline: candidate.headline,
                    location: candidate.location || (candidate.location_city ? `${candidate.location_city}, ${candidate.location_country}` : candidate.location_country),
                    current_company: candidate.current_company,
                    current_role: candidate.current_role,
                    linkedin_url: candidate.linkedin_url,
                    apollo_score: candidate.apollo_score,
                    email: candidate.email,
                    phone: candidate.phone,
                    industry: candidate.industry,
                    connections_count: candidate.connections_count,
                    follower_count: candidate.follower_count,
                    company_url: candidate.company_url,
                    company_website: candidate.company_website,
                    company_industry: candidate.company_industry,
                    experience_location: candidate.experience_location,
                    // Availability flags
                    has_email: candidate.has_email,
                    has_phone: candidate.has_phone,
                    has_location: candidate.has_location
                  })
                  setSheetOpen(true)
                }
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
        apolloId={selectedApolloId}
        apolloData={selectedApolloData}
        jobId={jobId}
        context="sourcing"
        hasPrev={hasPrev}
        hasNext={hasNext}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        searchCriteria={searchCriteria}
        onCandidateCollected={handleCandidateCollected}
      />
    </div>
  )
}
