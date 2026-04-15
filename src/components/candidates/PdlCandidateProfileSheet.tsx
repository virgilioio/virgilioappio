import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { EnhancedSkillBadge } from '@/components/ui/enhanced-skill-badge'
import { ProfileSummaryMarkdown } from '@/components/candidates/ProfileSummaryMarkdown'
import { CandidateWorkExperienceComponent, type CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import { CandidateEducationComponent, type CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import CandidateNameCard from '@/components/candidates/CandidateNameCard'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { copyToClipboard } from '@/utils/clipboard'
import { ChevronLeft, ChevronRight, Plus, Loader2, CheckCircle2, Mail, Phone, Copy, ExternalLink, MapPin, Briefcase, TrendingUp, Award, FileText, ChevronDown } from 'lucide-react'
import { ensureAbsoluteUrl } from '@/lib/utils'
import type { MatchedCandidate } from '@/hooks/useSourcingProjectCandidates'
import gioAiBannerIcon from '@/assets/gio-ai-banner-icon.png'
import { toast } from '@/hooks/use-toast'

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
  const location = [candidate.location_city, candidate.location_state, candidate.location_country].filter(Boolean).join(', ')
  const summaryText = candidate.summary || candidate.profile_summary

  // Map PDL experience to CandidateWorkExperience interface
  const workExperience: CandidateWorkExperience[] = (candidate.experience || []).map((exp, i) => ({
    id: `pdl-exp-${i}`,
    company_name: exp.company || 'Unknown Company',
    job_title: exp.title || 'Unknown Role',
    start_date: exp.start_date,
    end_date: exp.end_date,
    is_current: exp.is_current || false,
    description: exp.summary,
    location: exp.location,
    company_industry: exp.company_industry,
    company_size_category: exp.company_size,
  }))

  // Map PDL education to CandidateEducation interface
  const education: CandidateEducation[] = (candidate.education || []).map((edu, i) => ({
    id: `pdl-edu-${i}`,
    institution_name: edu.school || 'Unknown Institution',
    degree_type: edu.degree,
    field_of_study: edu.field_of_study,
    start_date: edu.start_date,
    end_date: edu.end_date,
  }))

  // Primary email/phone for the name card
  const primaryEmail = candidate.email || candidate.emails?.[0]?.address || null
  const primaryPhone = candidate.phone || candidate.phones?.[0]?.number || null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[96vw] sm:max-w-none h-full p-0" showOverlay={false}>
        <div className="flex h-full w-full">
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <SheetHeader className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="font-poppins font-bold tracking-page-title text-text-primary text-4xl">
                      {displayName}
                      <span className="text-purple-period">.</span>
                    </h2>
                    <Badge variant={candidate.is_gio_sourced ? "pastel-purple" : "pastel-green"} className="text-xs">
                      {candidate.is_gio_sourced ? "Gio · Enriched" : "PDL · Full Data"}
                    </Badge>
                    {candidate.linkedin_url && (
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => window.open(ensureAbsoluteUrl(candidate.linkedin_url!), '_blank')}
                        aria-label="Open LinkedIn profile"
                      >
                        <LinkedInFilled className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
                    {candidate.match_score > 0 && (
                      <Badge className="bg-emerald-500 text-white">{candidate.match_score}% match</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-sm">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 sm:gap-sm text-text-secondary hover:text-text-primary px-2 sm:px-3"
                    onClick={onNavigatePrev}
                    disabled={!hasPrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 sm:gap-sm text-text-secondary hover:text-text-primary px-2 sm:px-3"
                    onClick={onNavigateNext}
                    disabled={!hasNext}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column */}
                <div className="space-y-6 min-w-0">
                  <CandidateNameCard
                    email={primaryEmail}
                    phone={primaryPhone}
                    tabs={[{ value: 'overview', label: 'Overview', Icon: FileText }]}
                    activeTab="overview"
                    onTabChange={() => {}}
                  />

                  {/* AI Profile Summary */}
                  {summaryText && (
                    <Collapsible defaultOpen className="rounded-lg bg-pastel-purple/30 border border-pastel-purple/50">
                      <div className="p-4 flex items-start gap-3">
                        <img src={gioAiBannerIcon} alt="Gio AI" className="h-10 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">Profile Summary</p>
                          <p className="text-xs text-muted-foreground">{candidate.is_gio_sourced ? "Based on Gio enriched candidate data" : "Based on PDL candidate data"}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              navigator.clipboard.writeText(summaryText)
                              toast({ title: 'Summary copied to clipboard' })
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 [&[data-state=open]>svg]:rotate-180">
                              <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                        <div className="px-4 pb-4">
                          <ProfileSummaryMarkdown content={summaryText} className="text-text-primary leading-relaxed" />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  <Accordion type="multiple" defaultValue={['skills', 'experience', 'education']} className="space-y-4">
                    {/* Skills */}
                    {candidate.skills && candidate.skills.length > 0 && (
                      <AccordionItem value="skills" className="border-0">
                        <Card className="bg-surface-primary border-border">
                          <AccordionTrigger className="px-6 py-4 hover:no-underline">
                            <CardTitle>Skills</CardTitle>
                          </AccordionTrigger>
                          <AccordionContent>
                            <CardContent className="pt-0">
                              <div className="flex flex-wrap gap-2">
                                {candidate.skills.map((s, i) => (
                                  <EnhancedSkillBadge key={`${s}-${i}`} skill={s} variant="compact" showTooltip={true} interactive={false} />
                                ))}
                              </div>
                            </CardContent>
                          </AccordionContent>
                        </Card>
                      </AccordionItem>
                    )}

                    {/* Work Experience */}
                    <AccordionItem value="experience" className="border-0">
                      <Card className="bg-surface-primary border-border">
                        <AccordionTrigger className="px-6 py-4 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            <CardTitle>Work Experience</CardTitle>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <CardContent className="pt-0">
                            <CandidateWorkExperienceComponent experiences={workExperience} />
                          </CardContent>
                        </AccordionContent>
                      </Card>
                    </AccordionItem>

                    {/* Education */}
                    <AccordionItem value="education" className="border-0">
                      <Card className="bg-surface-primary border-border">
                        <AccordionTrigger className="px-6 py-4 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-muted-foreground" />
                            <CardTitle>Education</CardTitle>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <CardContent className="pt-0">
                            <CandidateEducationComponent education={education} />
                          </CardContent>
                        </AccordionContent>
                      </Card>
                    </AccordionItem>
                  </Accordion>
                </div>

                {/* Right column */}
                <div className="space-y-6">
                  {/* Candidate Details */}
                  <Card className="bg-surface-primary border-border">
                    <CardHeader>
                      <CardTitle>Candidate Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                      {/* Emails */}
                      <div className="space-y-2">
                        {candidate.emails && candidate.emails.length > 0 ? (
                          candidate.emails.map((e, idx) => (
                            <div key={`email-${idx}`} className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <Mail className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <a href={`mailto:${e.address}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                                    {e.address}
                                  </a>
                                  {e.type && <span className="text-xs text-text-tertiary capitalize">{e.type}</span>}
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => copyToClipboard(e.address, 'Email copied')}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))
                        ) : primaryEmail ? (
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <Mail className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                              <a href={`mailto:${primaryEmail}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                                {primaryEmail}
                              </a>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => copyToClipboard(primaryEmail, 'Email copied')}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      {/* Phones */}
                      <div className="space-y-2">
                        {candidate.phones && candidate.phones.length > 0 ? (
                          candidate.phones.map((p, idx) => (
                            <div key={`phone-${idx}`} className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <Phone className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <a href={`tel:${p.number}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                                    {p.number}
                                  </a>
                                  {p.type && <span className="text-xs text-text-tertiary capitalize">{p.type}</span>}
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => copyToClipboard(p.number, 'Phone copied')}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))
                        ) : primaryPhone ? (
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <Phone className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                              <a href={`tel:${primaryPhone}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                                {primaryPhone}
                              </a>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => copyToClipboard(primaryPhone, 'Phone copied')}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <Phone className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-text-tertiary italic">Phone not available</span>
                          </div>
                        )}
                      </div>

                      {/* LinkedIn */}
                      {candidate.linkedin_url && (
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <LinkedInFilled className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                            <a href={ensureAbsoluteUrl(candidate.linkedin_url)} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                              LinkedIn Profile
                            </a>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0 mt-0.5" />
                        </div>
                      )}

                      {/* GitHub */}
                      {candidate.github_url && (
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <ExternalLink className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                            <a href={ensureAbsoluteUrl(candidate.github_url)} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all">
                              GitHub Profile
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Location */}
                      {location && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-text-primary">{location}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Career Summary */}
                  {(candidate.current_role || candidate.current_company || candidate.years_experience || candidate.industry) && (
                    <Card className="bg-surface-primary border-border">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <CardTitle>Career Summary</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <dl className="divide-y divide-border">
                          {candidate.current_role && (
                            <div className="flex items-center justify-between py-2.5">
                              <dt className="text-sm text-muted-foreground">Current Title</dt>
                              <dd className="text-sm font-medium text-foreground text-right">{candidate.current_role}</dd>
                            </div>
                          )}
                          {candidate.current_company && (
                            <div className="flex items-center justify-between py-2.5">
                              <dt className="text-sm text-muted-foreground">Current Company</dt>
                              <dd className="text-sm font-medium text-foreground">{candidate.current_company}</dd>
                            </div>
                          )}
                          {candidate.industry && (
                            <div className="flex items-center justify-between py-2.5">
                              <dt className="text-sm text-muted-foreground">Industry</dt>
                              <dd className="text-sm font-medium text-foreground">{candidate.industry}</dd>
                            </div>
                          )}
                          {(candidate.years_experience || candidate.experience_years) && (
                            <div className="flex items-center justify-between py-2.5">
                              <dt className="text-sm text-muted-foreground">Years Experience</dt>
                              <dd className="text-sm font-medium text-foreground">{candidate.years_experience || candidate.experience_years}</dd>
                            </div>
                          )}
                          {candidate.job_title_levels && candidate.job_title_levels.length > 0 && (
                            <div className="flex items-center justify-between py-2.5">
                              <dt className="text-sm text-muted-foreground">Seniority</dt>
                              <dd className="text-sm font-medium text-foreground capitalize">{candidate.job_title_levels.join(', ')}</dd>
                            </div>
                          )}
                        </dl>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
