import { useState } from 'react'
import { useSavedCandidates, SavedCandidate } from '@/hooks/useSavedCandidates'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import UniversalCandidateProfileSheet from '@/components/candidates/UniversalCandidateProfileSheet'
import { 
  Loader2, 
  UserCheck, 
  Mail, 
  Phone, 
  Linkedin, 
  MapPin, 
  Building2, 
  Briefcase,
  ExternalLink
} from 'lucide-react'
import { format } from 'date-fns'

interface SavedCandidatesTabProps {
  projectId: string
}

export function SavedCandidatesTab({ projectId }: SavedCandidatesTabProps) {
  const { data: savedCandidates = [], isLoading } = useSavedCandidates({ 
    projectId, 
    enabled: !!projectId 
  })
  
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const selectedCandidate = selectedIndex !== null ? savedCandidates[selectedIndex] : null

  const handleCandidateClick = (index: number) => {
    setSelectedIndex(index)
    setSheetOpen(true)
  }

  const handleNavigatePrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const handleNavigateNext = () => {
    if (selectedIndex !== null && selectedIndex < savedCandidates.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }

  const formatLocation = (candidate: SavedCandidate) => {
    const parts = [
      candidate.location_city,
      candidate.location_state,
      candidate.location_country
    ].filter(Boolean)
    return parts.join(', ') || null
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (savedCandidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <UserCheck className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No candidates collected yet
        </h3>
        <p className="text-muted-foreground max-w-md">
          Candidates you reveal from the search results will appear here. 
          Go to the Candidates tab and click "Reveal Full Profile" to collect candidates.
        </p>
      </div>
    )
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="container mx-auto p-4">
          <div className="space-y-2">
            {savedCandidates.map((candidate, index) => (
              <div
                key={candidate.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => handleCandidateClick(index)}
              >
                <div className="flex-1 min-w-0">
                  {/* Name and Role */}
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-foreground truncate">
                      {candidate.candidate_name}
                    </h4>
                    {candidate.linkedin_url && (
                      <a
                        href={candidate.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-virgilio-purple hover:text-virgilio-purple/80"
                      >
                        <Linkedin className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  
                  {/* Current Position */}
                  {(candidate.role_current || candidate.company_current) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      {candidate.role_current && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {candidate.role_current}
                        </span>
                      )}
                      {candidate.company_current && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {candidate.company_current}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Contact & Location */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {candidate.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {candidate.email}
                      </span>
                    )}
                    {candidate.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {candidate.phone}
                      </span>
                    )}
                    {formatLocation(candidate) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {formatLocation(candidate)}
                      </span>
                    )}
                  </div>

                  {/* Job Associations */}
                  {candidate.job_associations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {candidate.job_associations.map((assoc, i) => (
                        <Badge 
                          key={i} 
                          variant="secondary" 
                          className="text-xs"
                        >
                          {assoc.job_title}
                          {assoc.stage_name && (
                            <span className="ml-1 opacity-70">• {assoc.stage_name}</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Side - Date & Action */}
                <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(candidate.apollo_collected_at), 'MMM d, yyyy')}
                  </span>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Candidate Profile Sheet */}
      <UniversalCandidateProfileSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        candidateId={selectedCandidate?.id || null}
        jobId={selectedCandidate?.job_associations[0]?.job_id || null}
        context={selectedCandidate?.job_associations.length ? 'job' : 'independent'}
        hasPrev={selectedIndex !== null && selectedIndex > 0}
        hasNext={selectedIndex !== null && selectedIndex < savedCandidates.length - 1}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
      />
    </>
  )
}
