import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { Sparkles, ExternalLink, AlertCircle, ChevronLeft, ChevronRight, Mail, Phone, Lock, Briefcase, GraduationCap, Wrench, MapPin, Users, UserPlus, Building2, Globe, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { useSourcingCreditWarnings } from '@/hooks/useSourcingCreditWarnings'
import AddToJobPipelineDialog from './AddToJobPipelineDialog'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Separator } from '@/components/ui/separator'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { JobSelectionDialog } from '@/components/sourcing/JobSelectionDialog'

interface ApolloPreviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId?: string | null
  apolloId?: string | null
  apolloData?: {
    candidate_name: string
    headline?: string
    location?: string
    current_company?: string
    current_role?: string
    linkedin_url?: string
    apollo_score?: number
    email?: string
    email_status?: string
    phone?: string
    industry?: string
    connections_count?: number
    follower_count?: number
    company_url?: string
    company_website?: string
    company_industry?: string
    experience_location?: string
    has_email?: boolean
    has_phone?: boolean
    has_location?: boolean
  }
  jobId?: string | null
  hasPrev?: boolean
  hasNext?: boolean
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
  onCandidateCollected?: (candidateId: string) => void
}

interface EnrichedCandidateData {
  candidate_id: string
  candidate_name: string
  linkedin_url?: string
  email?: string
  phone?: string
  location_city?: string
  location_state?: string
  location_country?: string
  skills?: string[]
  profile_summary?: string
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

export function ApolloPreviewSheet({
  open,
  onOpenChange,
  apolloId,
  apolloData,
  jobId,
  hasPrev,
  hasNext,
  onNavigatePrev,
  onNavigateNext,
  onCandidateCollected,
}: ApolloPreviewSheetProps) {
  const [isCollecting, setIsCollecting] = useState(false)
  const [collectedCandidateId, setCollectedCandidateId] = useState<string | null>(null)
  const [showJobSelection, setShowJobSelection] = useState(false)
  const [enrichedData, setEnrichedData] = useState<EnrichedCandidateData | null>(null)
  const { isCollectDisabled } = useSourcingCreditWarnings()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Reset enriched data when apolloId changes (navigating to different candidate)
  useEffect(() => {
    setEnrichedData(null)
    setCollectedCandidateId(null)
  }, [apolloId])

  const handleCollectProfile = async (
    selectedJobId?: string, 
    selectedJobName?: string,
    selectedStageId?: string,
    selectedStageName?: string
  ) => {
    if (!apolloId) return

    setIsCollecting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const jobIdToUse = selectedJobId || jobId
      
      const { data, error } = await supabase.functions.invoke('enrich-apollo-profile', {
        body: {
          apollo_id: apolloId,
          job_id: jobIdToUse,
          stage_id: selectedStageId,
          user_id: user?.id,
        }
      })

      if (error) throw error

      if (data?.candidate_id) {
        setCollectedCandidateId(data.candidate_id)
        
        // Fetch the full candidate data to display in the sheet
        const { data: candidateData, error: fetchError } = await supabase
          .from('candidates')
          .select('id, candidate_name, linkedin_url, email, phone, location_city, location_state, location_country, skills, profile_summary')
          .eq('id', data.candidate_id)
          .single()

        if (!fetchError && candidateData) {
          setEnrichedData({
            candidate_id: candidateData.id,
            candidate_name: candidateData.candidate_name,
            linkedin_url: candidateData.linkedin_url || undefined,
            email: candidateData.email || undefined,
            phone: candidateData.phone || undefined,
            location_city: candidateData.location_city || undefined,
            location_state: candidateData.location_state || undefined,
            location_country: candidateData.location_country || undefined,
            skills: candidateData.skills || undefined,
            profile_summary: candidateData.profile_summary || undefined,
          })
        }
        
        // Improved toast message with job and stage names
        const toastDescription = data.already_collected 
          ? jobIdToUse 
            ? `Profile was already in your database and has been added to ${selectedJobName || 'the job'} (${selectedStageName || 'stage'})`
            : 'Profile was already in your database'
          : jobIdToUse
            ? `Successfully added to ${selectedJobName || 'job'} at stage "${selectedStageName || 'Unknown'}"`
            : 'Full profile data is now available'
        
        toast({
          title: 'Profile Collected',
          description: toastDescription,
        })

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['sourcing-preview-candidates'] })
        queryClient.invalidateQueries({ queryKey: ['candidates'] })
        queryClient.invalidateQueries({ queryKey: ['sourcing-credits'] })

        // Notify parent to remove from list
        onCandidateCollected?.(data.candidate_id)
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

  const handleJobSelected = (
    jobId: string, 
    jobName: string, 
    stageId?: string, 
    stageName?: string
  ) => {
    setShowJobSelection(false)
    handleCollectProfile(jobId, jobName, stageId, stageName)
  }

  const handleSkipJobSelection = () => {
    setShowJobSelection(false)
    handleCollectProfile()
  }

  const handleNavigatePrev = () => {
    setEnrichedData(null)
    setCollectedCandidateId(null)
    onNavigatePrev?.()
  }

  const handleNavigateNext = () => {
    setEnrichedData(null)
    setCollectedCandidateId(null)
    onNavigateNext?.()
  }

  // Check availability flags (these indicate what CAN be revealed, not what IS available)
  const hasEmailAvailable = apolloData?.has_email ?? false
  const hasPhoneAvailable = apolloData?.has_phone ?? false
  const hasLocationAvailable = apolloData?.has_location ?? false
  
  // Check if Apollo already has the data (rare - only if previously enriched)
  const hasActualEmail = apolloData?.email && apolloData.email_status === 'verified'
  const hasActualPhone = apolloData?.phone

  // Derived state for display
  const isCollected = !!enrichedData
  const displayName = enrichedData?.candidate_name || apolloData?.candidate_name || 'Unknown Candidate'
  
  // Build full location string from enriched data
  const enrichedLocation = enrichedData 
    ? [enrichedData.location_city, enrichedData.location_state, enrichedData.location_country]
        .filter(Boolean)
        .join(', ')
    : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[96vw] sm:max-w-none h-full p-0" showOverlay={false}>
        <div className="flex h-full flex-col relative">
          <SheetHeader className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-poppins font-bold tracking-page-title text-text-primary text-4xl">
                    {displayName}
                    <span className="text-purple-period">.</span>
                  </h2>
                  {(enrichedData?.linkedin_url || apolloData?.linkedin_url) && (
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => window.open(enrichedData?.linkedin_url || apolloData?.linkedin_url, '_blank')}
                      aria-label="Open LinkedIn profile"
                    >
                      <LinkedInFilled className="h-5 w-5" />
                    </Button>
                  )}
                </div>
                {isCollected ? (
                  <Badge variant="outline" className="w-fit border-green-500 text-green-600 bg-green-50">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Collected - Full Data Available
                  </Badge>
                ) : (
                  <Badge variant="outline" className="w-fit border-warning text-warning">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Preview Only - Limited Data
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-sm">
                <Button
                  variant="ghost"
                  className="gap-sm text-text-secondary hover:text-text-primary"
                  onClick={handleNavigatePrev}
                  disabled={!hasPrev}
                  title="Previous candidate"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  className="gap-sm text-text-secondary hover:text-text-primary"
                  onClick={handleNavigateNext}
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
                    {isCollected ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 bg-green-50 p-3 rounded-md border border-green-200">
                          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                          <span className="text-green-700 font-medium">Profile Collected!</span>
                        </div>
                        <Button
                          variant="default"
                          onClick={() => navigate(`/candidates/${enrichedData.candidate_id}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Full Profile
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        {/* Primary Action - Improved messaging */}
                        <Button
                          onClick={handleOpenJobSelection}
                          disabled={isCollecting || isCollectDisabled}
                          className="flex-1"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          {isCollecting 
                            ? 'Collecting...' 
                            : isCollectDisabled 
                              ? 'Credit Limit Reached' 
                              : 'Reveal Full Profile (1 credit)'}
                        </Button>

                        <Separator orientation="vertical" className="h-6 mx-3" />

                        {/* Secondary Actions */}
                        <div className="flex items-center gap-2">
                          {apolloData?.linkedin_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(apolloData.linkedin_url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              LinkedIn
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Match Score Card */}
                {apolloData?.apollo_score !== undefined && (
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
                          {apolloData.apollo_score.toFixed(2)}
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
                  {(apolloData?.industry || apolloData?.connections_count !== undefined || apolloData?.follower_count !== undefined) && (
                    <AccordionItem value="professional" className="border-0">
                      <Card className="bg-surface-primary border-border">
                        <AccordionTrigger className="px-6 py-4 hover:no-underline">
                          <CardTitle>Professional Details</CardTitle>
                        </AccordionTrigger>
                        <AccordionContent>
                          <CardContent className="space-y-4 pt-0">
                            {apolloData?.industry && (
                              <div className="flex items-start gap-2">
                                <Briefcase className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                <div className="flex flex-col">
                                  <span className="text-xs text-text-tertiary">Industry</span>
                                  <span className="text-sm">{apolloData.industry}</span>
                                </div>
                              </div>
                            )}
                            
                            {apolloData?.connections_count !== undefined && (
                              <div className="flex items-start gap-2">
                                <Users className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                <div className="flex flex-col">
                                  <span className="text-xs text-text-tertiary">LinkedIn Connections</span>
                                  <span className="text-sm">{apolloData.connections_count.toLocaleString()}</span>
                                </div>
                              </div>
                            )}
                            
                            {apolloData?.follower_count !== undefined && (
                              <div className="flex items-start gap-2">
                                <UserPlus className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                <div className="flex flex-col">
                                  <span className="text-xs text-text-tertiary">LinkedIn Followers</span>
                                  <span className="text-sm">{apolloData.follower_count.toLocaleString()}</span>
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
                          {/* Location - Show enriched data if collected */}
                          {isCollected && enrichedLocation ? (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                              <span className="text-sm">{enrichedLocation}</span>
                            </div>
                          ) : apolloData?.location ? (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                              <span className="text-sm">{apolloData.location}</span>
                            </div>
                          ) : hasLocationAvailable ? (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-sm text-text-secondary italic">Location available after collection</span>
                              </div>
                            </div>
                          ) : null}

                          {/* LinkedIn - Show enriched data if collected */}
                          {isCollected && enrichedData?.linkedin_url ? (
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <LinkedInFilled className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                <a
                                  href={enrichedData.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                                >
                                  {enrichedData.linkedin_url}
                                </a>
                              </div>
                              <ExternalLink className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0 mt-0.5" />
                            </div>
                          ) : apolloData?.linkedin_url ? (
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <LinkedInFilled className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                <a
                                  href={apolloData.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                                >
                                  LinkedIn Profile
                                </a>
                              </div>
                              <ExternalLink className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0 mt-0.5" />
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <LinkedInFilled className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-text-secondary italic">LinkedIn URL available after collection</span>
                            </div>
                          )}

                          {/* Email - Show enriched data if collected */}
                          {isCollected && enrichedData?.email ? (
                            <div className="flex items-start gap-2">
                              <Mail className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <a href={`mailto:${enrichedData.email}`} className="text-sm text-blue-600 hover:underline">
                                    {enrichedData.email}
                                  </a>
                                  <Badge variant="secondary" className="text-xs">
                                    <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                                    Verified
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ) : hasActualEmail ? (
                            <div className="flex items-start gap-2">
                              <Mail className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <a href={`mailto:${apolloData?.email}`} className="text-sm text-blue-600 hover:underline">
                                    {apolloData?.email}
                                  </a>
                                  <Badge variant="secondary" className="text-xs">
                                    <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                                    Verified
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ) : hasEmailAvailable ? (
                            <div className="flex items-start gap-2">
                              <Mail className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-text-secondary italic">Email available after collection</span>
                            </div>
                          ) : (
                            <LockedField icon={Mail} label="Email" />
                          )}

                          {/* Phone - Show enriched data if collected */}
                          {isCollected && enrichedData?.phone ? (
                            <div className="flex items-start gap-2">
                              <Phone className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                              <a href={`tel:${enrichedData.phone}`} className="text-sm text-blue-600 hover:underline">
                                {enrichedData.phone}
                              </a>
                            </div>
                          ) : hasActualPhone ? (
                            <div className="flex items-start gap-2">
                              <Phone className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                              <a href={`tel:${apolloData?.phone}`} className="text-sm text-blue-600 hover:underline">
                                {apolloData?.phone}
                              </a>
                            </div>
                          ) : hasPhoneAvailable ? (
                            <div className="flex items-start gap-2">
                              <Phone className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-text-secondary italic">Phone available after collection</span>
                            </div>
                          ) : (
                            <LockedField icon={Phone} label="Phone" />
                          )}
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
                          {isCollected && enrichedData?.profile_summary ? (
                            <div className="text-sm text-text-primary">
                              {enrichedData.profile_summary}
                            </div>
                          ) : apolloData?.headline ? (
                            <div className="text-sm text-text-primary">
                              {apolloData.headline}
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
                          {(apolloData?.current_role || apolloData?.current_company) && (
                            <div className="border-l-2 border-primary pl-4 py-2">
                              <div className="font-medium text-text-primary">
                                {apolloData.current_role || 'Current Position'}
                              </div>
                              {apolloData.current_company && (
                                <div className="text-sm text-text-secondary mt-1 flex items-center gap-2">
                                  <Building2 className="h-3.5 w-3.5" />
                                  {apolloData.current_company}
                                </div>
                              )}
                              {apolloData?.experience_location && (
                                <div className="text-sm text-text-tertiary mt-1 flex items-center gap-2">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {apolloData.experience_location}
                                </div>
                              )}
                              {apolloData?.company_industry && (
                                <div className="text-sm text-text-tertiary mt-1 flex items-center gap-2">
                                  <Briefcase className="h-3.5 w-3.5" />
                                  {apolloData.company_industry}
                                </div>
                              )}
                              {(apolloData?.company_url || apolloData?.company_website) && (
                                <a
                                  href={apolloData.company_url || apolloData.company_website}
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

                          {/* Additional Experience - Show message based on collected state */}
                          {isCollected ? (
                            <div className="text-sm text-text-secondary text-center py-4">
                              View full work history on the candidate profile page
                            </div>
                          ) : (
                            <LockedSection 
                              message="Complete work history available after collection"
                            />
                          )}
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
                          {isCollected ? (
                            <div className="text-sm text-text-secondary text-center py-4">
                              View education history on the candidate profile page
                            </div>
                          ) : (
                            <LockedSection 
                              message="Education history available after collection"
                            />
                          )}
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
                          {isCollected && enrichedData?.skills && enrichedData.skills.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {enrichedData.skills.map((skill, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <LockedSection 
                              message="Complete skills list available after collection"
                            />
                          )}
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                </Accordion>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Success Notice (when collected) */}
                {isCollected ? (
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-6">
                      <div className="flex gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <div className="font-medium text-green-700">Profile Collected Successfully</div>
                          <div className="text-sm text-green-600">
                            Full contact information and profile data is now available. 
                            Click "View Full Profile" to see complete work history, education, and more.
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 border-green-300 text-green-700 hover:bg-green-100"
                            onClick={() => navigate(`/candidates/${enrichedData.candidate_id}`)}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Full Profile
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Information Notice */}
                    <Card className="bg-warning/10 border-warning">
                      <CardContent className="pt-6">
                        <div className="flex gap-3">
                          <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                          <div className="space-y-2">
                            <div className="font-medium text-warning">Preview Only - Limited Data</div>
                            <div className="text-sm text-text-secondary">
                              This is a search preview with obfuscated name. Collecting the full profile (1 credit) 
                              will reveal the LinkedIn URL, verified email, phone number, full name, and complete 
                              work history.
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* What You'll Unlock Card */}
                    <Card className="bg-primary/5 border-primary/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          What You'll Unlock
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm text-text-secondary mb-4">
                          Collecting this profile reveals:
                        </div>
                        {/* LinkedIn - Most important, highlight it */}
                        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-md border border-blue-200">
                          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-100">
                            <LinkedInFilled className="h-3.5 w-3.5 text-blue-600" />
                          </div>
                          <span className="text-sm font-medium text-blue-700">LinkedIn Profile URL</span>
                        </div>
                        {hasEmailAvailable && <UnlockItem icon={Mail} text="Verified email address" />}
                        {hasPhoneAvailable && <UnlockItem icon={Phone} text="Direct phone number" />}
                        {hasLocationAvailable && <UnlockItem icon={MapPin} text="Full location details" />}
                        <UnlockItem icon={Briefcase} text="Complete work history" />
                        <UnlockItem icon={GraduationCap} text="Education background" />
                        <UnlockItem icon={Wrench} text="Full skills list" />
                        <div className="pt-4 border-t border-border">
                          <div className="text-xs text-text-tertiary">
                            Cost: 1 sourcing credit
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
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
