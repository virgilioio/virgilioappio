import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { Sparkles, ExternalLink, AlertCircle, ChevronLeft, ChevronRight, Mail, Phone, Lock, Briefcase, GraduationCap, Wrench, MapPin, Users, UserPlus, Building2, Globe } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { useCoresignalCreditWarnings } from '@/hooks/useCoresignalCreditWarnings'
import AddToJobPipelineDialog from './AddToJobPipelineDialog'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Separator } from '@/components/ui/separator'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { JobSelectionDialog } from '@/components/sourcing/JobSelectionDialog'

interface CoreSignalPreviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId?: string | null
  coresignalId?: string | null
  coresignalData?: {
    candidate_name: string
    headline?: string
    location?: string
    current_company?: string
    current_role?: string
    linkedin_url?: string
    coresignal_score?: number
    industry?: string
    connections_count?: number
    follower_count?: number
    company_url?: string
    company_website?: string
    company_industry?: string
    experience_location?: string
  }
  jobId?: string | null
  hasPrev?: boolean
  hasNext?: boolean
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
  onCandidateCollected?: (candidateId: string) => void
}

// Helper component for locked fields (with icon)
function LockedField({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="relative">
      <div className="flex items-start gap-2 opacity-40 blur-[2px] select-none pointer-events-none">
        <Icon className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
        <span className="text-sm">████████████</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-1 text-xs text-text-tertiary bg-surface-primary/80 px-2 py-1 rounded">
          <Lock className="h-3 w-3" />
          <span>Locked</span>
        </div>
      </div>
    </div>
  )
}

// Helper component for locked sections (without specific icon)
function LockedSection({ message }: { message: string }) {
  return (
    <div className="relative py-8">
      <div className="opacity-30 blur-sm select-none pointer-events-none space-y-2">
        <div className="h-4 bg-border rounded w-3/4"></div>
        <div className="h-4 bg-border rounded w-full"></div>
        <div className="h-4 bg-border rounded w-2/3"></div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Lock className="h-5 w-5 text-text-tertiary" />
        <span className="text-xs text-text-tertiary text-center">{message}</span>
      </div>
    </div>
  )
}

// Helper component for unlock benefits list
function UnlockItem({ icon: Icon, text }: { icon: any, text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10">
        <Icon className="h-3 w-3 text-primary" />
      </div>
      <span className="text-sm text-text-primary">{text}</span>
    </div>
  )
}

export function CoreSignalPreviewSheet({
  open,
  onOpenChange,
  coresignalId,
  coresignalData,
  jobId,
  hasPrev,
  hasNext,
  onNavigatePrev,
  onNavigateNext,
  onCandidateCollected,
}: CoreSignalPreviewSheetProps) {
  const [isCollecting, setIsCollecting] = useState(false)
  const [collectedCandidateId, setCollectedCandidateId] = useState<string | null>(null)
  const [showJobSelection, setShowJobSelection] = useState(false)
  const { isCollectDisabled } = useCoresignalCreditWarnings()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const handleCollectProfile = async (selectedJobId?: string, selectedStageId?: string) => {
    if (!coresignalId) return

    setIsCollecting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const jobIdToUse = selectedJobId || jobId
      
      const { data, error } = await supabase.functions.invoke('collect-coresignal-profile', {
        body: {
          coresignal_id: parseInt(coresignalId),
          job_id: jobIdToUse,
          stage_id: selectedStageId,
          user_id: user?.id,
        }
      })

      if (error) throw error

      if (data?.candidate_id) {
        setCollectedCandidateId(data.candidate_id)
        
        toast({
          title: 'Profile Collected',
          description: data.already_collected 
            ? 'Profile was already in your database'
            : 'Full profile is being processed in the background',
        })

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['coresignal-preview-candidates'] })
        queryClient.invalidateQueries({ queryKey: ['candidates'] })
        queryClient.invalidateQueries({ queryKey: ['coresignal-usage'] })

        // Notify parent to remove from list
        onCandidateCollected?.(data.candidate_id)

        // Navigate to job pipeline if job was selected
        if (jobIdToUse) {
          onOpenChange(false)
          navigate(`/jobs/${jobIdToUse}/pipeline?candidate=${data.candidate_id}`)
        } else {
          onOpenChange(false)
        }
      }
    } catch (error: any) {
      console.error('Failed to collect profile:', error)
      
      toast({
        title: 'Collection Failed',
        description: error.message || 'Failed to collect full profile',
        variant: 'destructive',
      })
    } finally {
      setIsCollecting(false)
    }
  }

  const handleOpenJobSelection = () => {
    setShowJobSelection(true)
  }

  const handleJobSelected = (jobId: string, stageId?: string) => {
    setShowJobSelection(false)
    handleCollectProfile(jobId, stageId)
  }

  const handleSkipJobSelection = () => {
    setShowJobSelection(false)
    handleCollectProfile()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[96vw] sm:max-w-none h-full p-0" showOverlay={false}>
        <div className="flex h-full flex-col relative">
          <SheetHeader className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-poppins font-bold tracking-page-title text-text-primary text-4xl">
                    {coresignalData?.candidate_name || 'Unknown Candidate'}
                    <span className="text-purple-period">.</span>
                  </h2>
                  {coresignalData?.linkedin_url && (
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => window.open(coresignalData.linkedin_url, '_blank')}
                      aria-label="Open LinkedIn profile"
                    >
                      <LinkedInFilled className="h-5 w-5" />
                    </Button>
                  )}
                </div>
                <Badge variant="outline" className="w-fit border-warning text-warning">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Preview Only - Limited Data
                </Badge>
              </div>
              <div className="flex items-center gap-sm">
                <Button
                  variant="ghost"
                  className="gap-sm text-text-secondary hover:text-text-primary"
                  onClick={onNavigatePrev}
                  disabled={!hasPrev}
                  title="Previous candidate"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  className="gap-sm text-text-secondary hover:text-text-primary"
                  onClick={onNavigateNext}
                  disabled={!hasNext}
                  title="Next candidate"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Controls Card */}
                <Card className="bg-surface-primary border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between w-full">
                      {/* Primary Action */}
                      <Button
                        onClick={handleOpenJobSelection}
                        disabled={isCollecting || isCollectDisabled}
                        className="flex-1"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        {isCollecting ? 'Collecting...' : isCollectDisabled ? 'Credit Limit Reached' : 'Collect Full Profile (1 credit)'}
                      </Button>

                      <Separator orientation="vertical" className="h-6 mx-3" />

                      {/* Secondary Actions */}
                      <div className="flex items-center gap-2">
                        {coresignalData?.linkedin_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(coresignalData.linkedin_url, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            LinkedIn
                          </Button>
                        )}
                        {jobId && collectedCandidateId && (
                          <AddToJobPipelineDialog candidateId={collectedCandidateId} />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Match Score Card */}
                {coresignalData?.coresignal_score !== undefined && (
                  <Card className="bg-surface-primary border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        Match Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <div className="text-3xl font-bold text-primary">
                          {coresignalData.coresignal_score.toFixed(2)}
                        </div>
                        <div className="text-sm text-text-secondary">
                          Based on job requirements and candidate profile
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Accordion Sections */}
                <Accordion type="multiple" defaultValue={['contact', 'summary', 'experience', 'professional']} className="space-y-4">
                  {/* Professional Details */}
                  {(coresignalData?.industry || coresignalData?.connections_count !== undefined || coresignalData?.follower_count !== undefined) && (
                    <AccordionItem value="professional" className="border-0">
                      <Card className="bg-surface-primary border-border">
                        <AccordionTrigger className="px-6 py-4 hover:no-underline">
                          <CardTitle>Professional Details</CardTitle>
                        </AccordionTrigger>
                        <AccordionContent>
                          <CardContent className="space-y-4 pt-0">
                            {coresignalData?.industry && (
                              <div className="flex items-start gap-2">
                                <Briefcase className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                <div className="flex flex-col">
                                  <span className="text-xs text-text-tertiary">Industry</span>
                                  <span className="text-sm">{coresignalData.industry}</span>
                                </div>
                              </div>
                            )}
                            
                            {coresignalData?.connections_count !== undefined && (
                              <div className="flex items-start gap-2">
                                <Users className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                <div className="flex flex-col">
                                  <span className="text-xs text-text-tertiary">LinkedIn Connections</span>
                                  <span className="text-sm">{coresignalData.connections_count.toLocaleString()}</span>
                                </div>
                              </div>
                            )}
                            
                            {coresignalData?.follower_count !== undefined && (
                              <div className="flex items-start gap-2">
                                <UserPlus className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                <div className="flex flex-col">
                                  <span className="text-xs text-text-tertiary">LinkedIn Followers</span>
                                  <span className="text-sm">{coresignalData.follower_count.toLocaleString()}</span>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </AccordionContent>
                      </Card>
                    </AccordionItem>
                  )}

                  {/* Contact Information */}
                  <AccordionItem value="contact" className="border-0">
                    <Card className="bg-surface-primary border-border">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <CardTitle>Contact Information</CardTitle>
                      </AccordionTrigger>
                      <AccordionContent>
                        <CardContent className="space-y-4 pt-0">
                          {/* Location - Available */}
                          {coresignalData?.location && (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                              <span className="text-sm">{coresignalData.location}</span>
                            </div>
                          )}

                          {/* LinkedIn - Available */}
                          {coresignalData?.linkedin_url && (
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <LinkedInFilled className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                <a
                                  href={coresignalData.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                                >
                                  LinkedIn Profile
                                </a>
                              </div>
                              <ExternalLink className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0 mt-0.5" />
                            </div>
                          )}

                          {/* Email - Locked */}
                          <LockedField icon={Mail} label="Email" />

                          {/* Phone - Locked */}
                          <LockedField icon={Phone} label="Phone" />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Profile Summary */}
                  <AccordionItem value="summary" className="border-0">
                    <Card className="bg-surface-primary border-border">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <CardTitle>Profile Summary</CardTitle>
                          <Sparkles className="h-4 w-4 text-purple-500 flex-shrink-0" />
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          {coresignalData?.headline ? (
                            <div className="text-sm text-text-primary">
                              {coresignalData.headline}
                            </div>
                          ) : (
                            <LockedSection 
                              message="Full profile summary available after collection"
                            />
                          )}
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Work Experience */}
                  <AccordionItem value="experience" className="border-0">
                    <Card className="bg-surface-primary border-border">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <CardTitle className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Work Experience
                        </CardTitle>
                      </AccordionTrigger>
                      <AccordionContent>
                        <CardContent className="space-y-4 pt-0">
                          {/* Current Position - Available */}
                          {(coresignalData?.current_role || coresignalData?.current_company) && (
                            <div className="border-l-2 border-primary pl-4 py-2">
                              <div className="font-medium text-text-primary">
                                {coresignalData.current_role || 'Current Position'}
                              </div>
                              {coresignalData.current_company && (
                                <div className="text-sm text-text-secondary mt-1 flex items-center gap-2">
                                  <Building2 className="h-3.5 w-3.5" />
                                  {coresignalData.current_company}
                                </div>
                              )}
                              {coresignalData?.experience_location && (
                                <div className="text-sm text-text-tertiary mt-1 flex items-center gap-2">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {coresignalData.experience_location}
                                </div>
                              )}
                              {coresignalData?.company_industry && (
                                <div className="text-sm text-text-tertiary mt-1 flex items-center gap-2">
                                  <Briefcase className="h-3.5 w-3.5" />
                                  {coresignalData.company_industry}
                                </div>
                              )}
                              {(coresignalData?.company_url || coresignalData?.company_website) && (
                                <a
                                  href={coresignalData.company_url || coresignalData.company_website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline mt-1 flex items-center gap-2"
                                >
                                  <Globe className="h-3.5 w-3.5" />
                                  Company Website
                                </a>
                              )}
                              <Badge variant="secondary" className="mt-2 text-xs">
                                Current
                              </Badge>
                            </div>
                          )}

                          {/* Additional Experience - Locked */}
                          <LockedSection 
                            message="Complete work history available after collection"
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Education */}
                  <AccordionItem value="education" className="border-0">
                    <Card className="bg-surface-primary border-border">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <CardTitle className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" />
                          Education
                        </CardTitle>
                      </AccordionTrigger>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <LockedSection 
                            message="Education history available after collection"
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Skills */}
                  <AccordionItem value="skills" className="border-0">
                    <Card className="bg-surface-primary border-border">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <CardTitle className="flex items-center gap-2">
                          <Wrench className="h-4 w-4" />
                          Skills
                        </CardTitle>
                      </AccordionTrigger>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <LockedSection 
                            message="Complete skills list available after collection"
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                </Accordion>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Information Notice */}
                <Card className="bg-warning/10 border-warning">
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <div className="font-medium text-warning">Limited Preview Data</div>
                        <div className="text-sm text-text-secondary">
                          This is a preview from CoreSignal's search results. To view the full profile including 
                          complete work experience, education, skills, and contact information, you need to collect the 
                          full profile (costs 1 CoreSignal credit).
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* What You'll Get Card */}
                <Card className="bg-surface-primary border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      Unlock Full Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-text-secondary mb-4">
                      Collecting the full profile will give you access to:
                    </div>
                    <UnlockItem icon={Mail} text="Email address" />
                    <UnlockItem icon={Phone} text="Phone number" />
                    <UnlockItem icon={Briefcase} text="Complete work history" />
                    <UnlockItem icon={GraduationCap} text="Education background" />
                    <UnlockItem icon={Wrench} text="Full skills list" />
                    <div className="pt-4 border-t border-border">
                      <div className="text-xs text-text-tertiary">
                        Cost: 1 CoreSignal credit
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>

      <JobSelectionDialog
        open={showJobSelection}
        onOpenChange={setShowJobSelection}
        onJobSelected={handleJobSelected}
        onSkip={handleSkipJobSelection}
      />
    </Sheet>
  )
}
