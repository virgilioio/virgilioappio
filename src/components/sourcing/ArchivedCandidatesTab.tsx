import { useState } from 'react'
import { useSavedCandidates, SavedCandidate } from '@/hooks/useSavedCandidates'
import { useArchiveSavedCandidate } from '@/hooks/useArchiveSavedCandidate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import UniversalCandidateProfileSheet from '@/components/candidates/UniversalCandidateProfileSheet'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { 
  Mail, 
  Phone, 
  MapPin, 
  RotateCcw
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftArchive } from '@/components/ui/EmptyIllustrations'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface ArchivedCandidatesTabProps {
  projectId: string
}

export function ArchivedCandidatesTab({ projectId }: ArchivedCandidatesTabProps) {
  const { data: archivedCandidates = [], isLoading } = useSavedCandidates({ 
    projectId, 
    enabled: !!projectId,
    status: 'archived'
  })
  
  const { restoreCandidate, isRestoring } = useArchiveSavedCandidate()
  
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const selectedCandidate = selectedIndex !== null ? archivedCandidates[selectedIndex] : null

  const handleRestore = (e: React.MouseEvent, candidate: SavedCandidate) => {
    e.stopPropagation()
    restoreCandidate({ apolloId: candidate.apollo_id!, projectId })
  }

  const formatLocation = (c: SavedCandidate) =>
    [c.location_city, c.location_state, c.location_country].filter(Boolean).join(', ') || null

  if (isLoading) {
    return (
      <Card className="shadow-calendly m-4">
        <CardContent className="p-0">
          <Table>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={1} className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-16 rounded-full" />
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    )
  }

  if (archivedCandidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <EmptyState
          illustration={<SoftArchive />}
          title="No archived candidates"
          body="Candidates you archive are kept here for reference."
        />
      </div>
    )
  }

  return (
    <>
      <div className="h-full min-h-0 flex flex-col overflow-hidden">
        <Card className="shadow-calendly mx-4 mt-4 flex-1 min-h-0 flex flex-col overflow-hidden">
          <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-full">Candidate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedCandidates.map((candidate, index) => {
                    const isActiveRow = sheetOpen && selectedIndex === index
                    const location = formatLocation(candidate)

                    return (
                      <TableRow
                        key={candidate.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/40 opacity-75",
                          isActiveRow && "bg-primary/5 border-l-2 border-l-primary opacity-100"
                        )}
                        onClick={() => { setSelectedIndex(index); setSheetOpen(true) }}
                      >
                        <TableCell colSpan={1} className="py-3 px-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0 space-y-1.5">
                              {/* Badge row */}
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Archived</Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(candidate.apollo_collected_at), 'MMM d, yyyy')}
                                </span>
                              </div>
                              {/* Name */}
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{candidate.candidate_name}</span>
                                {candidate.linkedin_url && (
                                  <a
                                    href={candidate.linkedin_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    <LinkedInFilled className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                              {/* Role @ Company */}
                              {(candidate.role_current || candidate.company_current) && (
                                <p className="text-xs text-muted-foreground">
                                  {candidate.role_current}
                                  {candidate.role_current && candidate.company_current && ' at '}
                                  {candidate.company_current}
                                </p>
                              )}
                              {/* Metadata chips */}
                              <div className="flex items-center gap-3 flex-wrap">
                                {location && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                                    <MapPin className="h-2.5 w-2.5" />{location}
                                  </span>
                                )}
                                {candidate.email && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                                    <Mail className="h-2.5 w-2.5" />{candidate.email}
                                  </span>
                                )}
                                {candidate.phone && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                                    <Phone className="h-2.5 w-2.5" />{candidate.phone}
                                  </span>
                                )}
                              </div>
                              {/* Job associations */}
                              {candidate.job_associations.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {candidate.job_associations.map((assoc, i) => (
                                    <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                      {assoc.job_title}
                                      {assoc.stage_name && <span className="ml-1 opacity-70">• {assoc.stage_name}</span>}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Restore button */}
                            <div className="flex items-center pt-0.5 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => handleRestore(e, candidate)}
                                disabled={isRestoring}
                                title="Restore candidate"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <UniversalCandidateProfileSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        candidateId={selectedCandidate?.id || null}
        jobId={selectedCandidate?.job_associations[0]?.job_id || null}
        context={selectedCandidate?.job_associations.length ? 'job' : 'independent'}
        hasPrev={selectedIndex !== null && selectedIndex > 0}
        hasNext={selectedIndex !== null && selectedIndex < archivedCandidates.length - 1}
        onNavigatePrev={() => selectedIndex !== null && selectedIndex > 0 && setSelectedIndex(selectedIndex - 1)}
        onNavigateNext={() => selectedIndex !== null && selectedIndex < archivedCandidates.length - 1 && setSelectedIndex(selectedIndex + 1)}
      />
    </>
  )
}
