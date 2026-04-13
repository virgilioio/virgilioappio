import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Linkedin, Mail, Phone, MapPin, Briefcase, Calendar, ChevronLeft, ChevronRight, Plus, Loader2, CheckCircle2, ExternalLink } from 'lucide-react'
import { ensureAbsoluteUrl } from '@/lib/utils'
import type { MatchedCandidate } from '@/hooks/useSourcingProjectCandidates'

interface PdlCandidateProfileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidate: MatchedCandidate
  hasPrev?: boolean
  hasNext?: boolean
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
  onAddToPipeline?: () => void
  isAddingToPipeline?: boolean
  isAlreadyAdded?: boolean
}

export function PdlCandidateProfileSheet({
  open,
  onOpenChange,
  candidate,
  hasPrev,
  hasNext,
  onNavigatePrev,
  onNavigateNext,
  onAddToPipeline,
  isAddingToPipeline,
  isAlreadyAdded,
}: PdlCandidateProfileSheetProps) {
  const displayName = candidate.full_name || candidate.candidate_name || 'Unknown'
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2)
  const location = [candidate.location_city, candidate.location_state, candidate.location_country].filter(Boolean).join(', ')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        {/* Navigation bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 border-b bg-background">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNavigatePrev} disabled={!hasPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNavigateNext} disabled={!hasNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Badge variant="pastel-green" className="text-xs">PDL · Full Data</Badge>
        </div>

        <div className="p-6 space-y-6">
          <SheetHeader className="space-y-0 text-left">
            <SheetTitle className="sr-only">{displayName}</SheetTitle>
            <SheetDescription className="sr-only">PDL candidate profile</SheetDescription>
          </SheetHeader>

          {/* Header */}
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 font-semibold text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold">{displayName}</h2>
              {candidate.current_role && (
                <p className="text-sm text-muted-foreground">
                  {candidate.current_role}
                  {candidate.current_company && ` at ${candidate.current_company}`}
                </p>
              )}
              {location && (
                <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {candidate.linkedin_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={ensureAbsoluteUrl(candidate.linkedin_url)} target="_blank" rel="noopener noreferrer">
                  <Linkedin className="h-4 w-4 mr-1.5" />
                  LinkedIn
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
            {isAlreadyAdded ? (
              <Button size="sm" variant="secondary" disabled>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Added to Pipeline
              </Button>
            ) : (
              <Button size="sm" onClick={onAddToPipeline} disabled={isAddingToPipeline}>
                {isAddingToPipeline ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1.5" />
                )}
                Add to Pipeline
              </Button>
            )}
          </div>

          <Separator />

          {/* Contact Info */}
          {(candidate.email || candidate.phone) && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact</h3>
              {candidate.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${candidate.email}`} className="text-primary hover:underline">{candidate.email}</a>
                </div>
              )}
              {candidate.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{candidate.phone}</span>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {(candidate.summary || candidate.profile_summary) && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Summary</h3>
              <p className="text-sm leading-relaxed">{candidate.summary || candidate.profile_summary}</p>
            </div>
          )}

          {/* Experience */}
          {(candidate.years_experience || candidate.experience_years || candidate.current_company) && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Experience</h3>
              {(candidate.years_experience || candidate.experience_years) && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{candidate.years_experience || candidate.experience_years} years of experience</span>
                </div>
              )}
              {candidate.current_company && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>{candidate.current_role ? `${candidate.current_role} at ` : ''}{candidate.current_company}</span>
                </div>
              )}
            </div>
          )}

          {/* Skills */}
          {candidate.skills && candidate.skills.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map(skill => (
                  <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Match Score */}
          {candidate.match_score > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Match</h3>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500 text-white">{candidate.match_score}%</Badge>
                <span className="text-sm text-muted-foreground capitalize">{candidate.match_tier} match</span>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
