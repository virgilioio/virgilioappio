import { useState, useEffect, useMemo } from 'react'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { 
  Sparkles, ExternalLink, AlertCircle, ChevronLeft, ChevronRight, 
  Mail, Phone, Lock, Briefcase, GraduationCap, Wrench, MapPin, 
  Users, UserPlus, Building2, Globe, CheckCircle2, TrendingUp,
  Target, Zap, Eye, Check
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { useSourcingCreditWarnings } from '@/hooks/useSourcingCreditWarnings'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Separator } from '@/components/ui/separator'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { JobSelectionDialog } from '@/components/sourcing/JobSelectionDialog'
import { 
  calculateFitScore, 
  generateGioTake, 
  getFitScoreLabel, 
  getFitScoreColor,
  getSignalBarColor,
  type FitScore,
  type GioTake
} from '@/lib/candidateFitScoring'
import type { SearchCriteria } from '@/types/sourcing'
import { cn } from '@/lib/utils'

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
  searchCriteria?: SearchCriteria
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

// Signal bar component for fit indicators
function SignalBar({ 
  label, 
  tier, 
  icon: Icon 
}: { 
  label: string
  tier: 'low' | 'medium' | 'high'
  icon: React.ElementType
}) {
  const tierLabels = { low: 'Low', medium: 'Medium', high: 'High' }
  const tierColors = {
    low: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    high: 'bg-green-100 text-green-700 border-green-200'
  }
  
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-text-secondary" />
      <span className="text-sm text-text-secondary">{label}</span>
      <Badge variant="outline" className={cn("text-xs", tierColors[tier])}>
        {tierLabels[tier]}
      </Badge>
    </div>
  )
}

// Circular score display
function FitScoreCircle({ score, label }: { score: number; label: string }) {
  const circumference = 2 * Math.PI * 36
  const strokeDashoffset = circumference - (score / 100) * circumference
  
  const getScoreGradient = (s: number) => {
    if (s >= 70) return 'url(#scoreGradientHigh)'
    if (s >= 50) return 'url(#scoreGradientMedium)'
    return 'url(#scoreGradientLow)'
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90">
          <defs>
            <linearGradient id="scoreGradientHigh" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <linearGradient id="scoreGradientMedium" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6F3FF5" />
              <stop offset="100%" stopColor="#9B7BF7" />
            </linearGradient>
            <linearGradient id="scoreGradientLow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <circle
            cx="48"
            cy="48"
            r="36"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-border"
          />
          <circle
            cx="48"
            cy="48"
            r="36"
            stroke={getScoreGradient(score)}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-text-primary">{score}</span>
        </div>
      </div>
      <span className={cn("text-sm font-medium mt-1", getFitScoreColor(score))}>
        {label}
      </span>
    </div>
  )
}

// Unlock benefit item
function UnlockBenefit({ icon: Icon, text, available }: { icon: React.ElementType; text: string; available?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "flex items-center justify-center h-5 w-5 rounded-full",
        available ? "bg-green-100" : "bg-primary/10"
      )}>
        {available ? (
          <Check className="h-3 w-3 text-green-600" />
        ) : (
          <Icon className="h-3 w-3 text-primary" />
        )}
      </div>
      <span className={cn("text-sm", available ? "text-green-700" : "text-text-secondary")}>
        {text}
      </span>
    </div>
  )
}

// Info row component
function InfoRow({ icon: Icon, label, value, className }: { 
  icon: React.ElementType
  label: string
  value: string | React.ReactNode
  className?: string 
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Icon className="h-4 w-4 text-text-tertiary mt-0.5 flex-shrink-0" />
      <div className="flex flex-col min-w-0">
        <span className="text-xs text-text-tertiary">{label}</span>
        <span className="text-sm text-text-primary break-words">{value}</span>
      </div>
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
  searchCriteria,
}: ApolloPreviewSheetProps) {
  const [isCollecting, setIsCollecting] = useState(false)
  const [collectedCandidateId, setCollectedCandidateId] = useState<string | null>(null)
  const [collectedJobId, setCollectedJobId] = useState<string | null>(null)
  const [showJobSelection, setShowJobSelection] = useState(false)
  const [enrichedData, setEnrichedData] = useState<EnrichedCandidateData | null>(null)
  const { isCollectDisabled } = useSourcingCreditWarnings()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Reset state when apolloId changes
  useEffect(() => {
    setEnrichedData(null)
    setCollectedCandidateId(null)
    setCollectedJobId(null)
  }, [apolloId])

  // Calculate fit score and Gio's take
  const fitScore: FitScore = useMemo(() => {
    if (!apolloData) {
      return { overall: 50, roleAlignment: 'medium', skillsMatch: 'medium', locationMatch: 'medium', confidence: 0, dataRichness: 0 }
    }
    return calculateFitScore(apolloData, searchCriteria)
  }, [apolloData, searchCriteria])

  const gioTake: GioTake = useMemo(() => {
    if (!apolloData) {
      return { summary: 'No candidate data available.', strengths: [], concerns: [] }
    }
    return generateGioTake(apolloData, searchCriteria, fitScore)
  }, [apolloData, searchCriteria, fitScore])

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

      const collectedResult = data?.results?.[0]
      const candidateId = collectedResult?.candidate_id
      const wasAlreadyCollected = collectedResult?.already_collected

      if (candidateId) {
        setCollectedCandidateId(candidateId)
        
        const { data: candidateData } = await supabase
          .from('candidates')
          .select('id, candidate_name, linkedin_url, email, phone, location_city, location_state, location_country, skills, profile_summary')
          .eq('id', candidateId)
          .single()

        if (candidateData) {
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
          setCollectedJobId(jobIdToUse || null)
        }
        
        const toastDescription = wasAlreadyCollected 
          ? jobIdToUse 
            ? `Profile was already in your database and has been added to ${selectedJobName || 'the job'}`
            : 'Profile was already in your database'
          : jobIdToUse
            ? `Successfully added to ${selectedJobName || 'job'} at stage "${selectedStageName || 'Unknown'}"`
            : 'Full profile data is now available'
        
        toast({
          title: 'Profile Collected',
          description: toastDescription,
        })

        queryClient.invalidateQueries({ queryKey: ['sourcing-preview-candidates'] })
        queryClient.invalidateQueries({ queryKey: ['candidates'] })
        queryClient.invalidateQueries({ queryKey: ['sourcing-credits'] })

        onCandidateCollected?.(candidateId)
      }
    } catch (error: any) {
      toast({
        title: 'Collection Failed',
        description: error.message || 'Failed to collect full profile',
        variant: 'destructive',
      })
    } finally {
      setIsCollecting(false)
    }
  }

  const handleJobSelected = (jobId: string, jobName: string, stageId?: string, stageName?: string) => {
    setShowJobSelection(false)
    handleCollectProfile(jobId, jobName, stageId, stageName)
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

  // Derived state
  const hasEmailAvailable = apolloData?.has_email ?? false
  const hasPhoneAvailable = apolloData?.has_phone ?? false
  const isCollected = !!enrichedData
  const displayName = enrichedData?.candidate_name || apolloData?.candidate_name || 'Unknown Candidate'
  
  const enrichedLocation = enrichedData 
    ? [enrichedData.location_city, enrichedData.location_state, enrichedData.location_country]
        .filter(Boolean).join(', ')
    : null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[96vw] sm:max-w-2xl h-full p-0" showOverlay={false}>
          <div className="flex h-full flex-col">
            {/* Header */}
            <SheetHeader className="p-6 border-b bg-surface-primary">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="font-poppins font-bold tracking-tight text-text-primary text-2xl truncate">
                      {displayName}
                      <span className="text-purple-period">.</span>
                    </h2>
                    {(enrichedData?.linkedin_url || apolloData?.linkedin_url) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 flex-shrink-0"
                        onClick={() => window.open(enrichedData?.linkedin_url || apolloData?.linkedin_url, '_blank')}
                      >
                        <LinkedInFilled className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {isCollected ? (
                    <Badge variant="outline" className="w-fit border-green-500 text-green-600 bg-green-50">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Collected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="w-fit border-amber-400 text-amber-600 bg-amber-50">
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNavigatePrev}
                    disabled={!hasPrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNavigateNext}
                    disabled={!hasNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Fit Snapshot Card */}
              {!isCollected && (
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Fit Snapshot
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-6">
                      {/* Score Circle */}
                      <FitScoreCircle 
                        score={fitScore.overall} 
                        label={getFitScoreLabel(fitScore.overall)} 
                      />
                      
                      {/* Signal Bars */}
                      <div className="flex-1 space-y-2.5">
                        <SignalBar 
                          label="Role alignment" 
                          tier={fitScore.roleAlignment} 
                          icon={Target} 
                        />
                        <SignalBar 
                          label="Skills match" 
                          tier={fitScore.skillsMatch} 
                          icon={Wrench} 
                        />
                        <SignalBar 
                          label="Location" 
                          tier={fitScore.locationMatch} 
                          icon={MapPin} 
                        />
                      </div>
                    </div>

                    {/* Gio's Take */}
                    <div className="pt-3 border-t border-border/50">
                      <div className="flex items-start gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Zap className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs font-medium text-primary">Gio's Take</span>
                          <p className="text-sm text-text-secondary leading-relaxed">
                            {gioTake.summary}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* What We Know So Far */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {isCollected ? 'Profile Details' : 'What We Know So Far'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(apolloData?.current_role || enrichedData) && (
                      <InfoRow 
                        icon={Briefcase} 
                        label="Current Role" 
                        value={apolloData?.current_role || 'Not specified'} 
                      />
                    )}
                    {(apolloData?.current_company || enrichedData) && (
                      <InfoRow 
                        icon={Building2} 
                        label="Company" 
                        value={apolloData?.current_company || 'Not specified'} 
                      />
                    )}
                    {(apolloData?.location || enrichedLocation) && (
                      <InfoRow 
                        icon={MapPin} 
                        label="Location" 
                        value={enrichedLocation || apolloData?.location || 'Not specified'} 
                      />
                    )}
                    {apolloData?.industry && (
                      <InfoRow 
                        icon={TrendingUp} 
                        label="Industry" 
                        value={apolloData.industry} 
                      />
                    )}
                    {apolloData?.connections_count !== undefined && (
                      <InfoRow 
                        icon={Users} 
                        label="LinkedIn Connections" 
                        value={apolloData.connections_count.toLocaleString()} 
                      />
                    )}
                    {apolloData?.company_industry && (
                      <InfoRow 
                        icon={Globe} 
                        label="Company Industry" 
                        value={apolloData.company_industry} 
                      />
                    )}
                  </div>

                  {/* Headline */}
                  {apolloData?.headline && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-text-secondary italic">
                        "{apolloData.headline}"
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Unlock CTA - Only show when not collected */}
              {!isCollected && (
                <Card className="border-dashed border-primary/30 bg-primary/5">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h4 className="font-semibold text-text-primary">
                            Unlock full profile with 1 credit
                          </h4>
                          <p className="text-sm text-text-secondary mt-1">
                            Get verified contact info and complete work history
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <UnlockBenefit icon={Mail} text="Verified email" available={hasEmailAvailable} />
                          <UnlockBenefit icon={Phone} text="Phone number" available={hasPhoneAvailable} />
                          <UnlockBenefit icon={Briefcase} text="Full work history" />
                          <UnlockBenefit icon={GraduationCap} text="Education details" />
                          <UnlockBenefit icon={Wrench} text="Complete skills" />
                          <UnlockBenefit icon={Sparkles} text="AI career summary" />
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                          <Button
                            onClick={() => setShowJobSelection(true)}
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
                          {apolloData?.linkedin_url && (
                            <Button
                              variant="outline"
                              onClick={() => window.open(apolloData.linkedin_url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              LinkedIn
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Collected State CTA */}
              {isCollected && (
                <Card className="border-green-200 bg-green-50/50">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-green-800">Profile Collected</h4>
                          <p className="text-sm text-green-600">Full details now available</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => {
                          if (collectedJobId) {
                            navigate(`/jobs/${collectedJobId}/candidates/${enrichedData?.candidate_id}`)
                          } else {
                            navigate(`/candidates/${enrichedData?.candidate_id}`)
                          }
                        }}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {collectedJobId ? 'View in Pipeline' : 'View Profile'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Accordion Sections */}
              <Accordion 
                type="multiple" 
                defaultValue={isCollected ? ['contact', 'experience', 'skills'] : ['experience']} 
                className="space-y-3"
              >
                {/* Contact Information */}
                <AccordionItem value="contact" className="border rounded-lg bg-surface-primary">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-text-secondary" />
                      <span className="font-medium">Contact Information</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-4 pb-4 space-y-3">
                      {isCollected ? (
                        <>
                          {enrichedData?.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-text-secondary" />
                              <a href={`mailto:${enrichedData.email}`} className="text-sm text-blue-600 hover:underline">
                                {enrichedData.email}
                              </a>
                              <Badge variant="secondary" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                                Verified
                              </Badge>
                            </div>
                          )}
                          {enrichedData?.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-text-secondary" />
                              <a href={`tel:${enrichedData.phone}`} className="text-sm text-blue-600 hover:underline">
                                {enrichedData.phone}
                              </a>
                            </div>
                          )}
                          {enrichedData?.linkedin_url && (
                            <div className="flex items-center gap-2">
                              <LinkedInFilled className="h-4 w-4 text-text-secondary" />
                              <a 
                                href={enrichedData.linkedin_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline truncate"
                              >
                                {enrichedData.linkedin_url}
                              </a>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-text-tertiary">
                            <Lock className="h-4 w-4" />
                            <span className="text-sm">Contact details available after collection</span>
                          </div>
                          {hasEmailAvailable && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-green-500" />
                              <span className="text-sm text-green-600">Email available</span>
                            </div>
                          )}
                          {hasPhoneAvailable && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-green-500" />
                              <span className="text-sm text-green-600">Phone available</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Work Experience */}
                <AccordionItem value="experience" className="border rounded-lg bg-surface-primary">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-text-secondary" />
                      <span className="font-medium">Work Experience</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-4 pb-4 space-y-4">
                      {/* Current Position - Always visible */}
                      {(apolloData?.current_role || apolloData?.current_company) && (
                        <div className="border-l-2 border-primary pl-4 py-2">
                          <div className="font-medium text-text-primary">
                            {apolloData?.current_role || 'Current Position'}
                          </div>
                          {apolloData?.current_company && (
                            <div className="flex items-center gap-2 mt-1 text-sm text-text-secondary">
                              <Building2 className="h-3.5 w-3.5" />
                              {apolloData.current_company}
                            </div>
                          )}
                          {apolloData?.experience_location && (
                            <div className="flex items-center gap-2 mt-1 text-sm text-text-tertiary">
                              <MapPin className="h-3.5 w-3.5" />
                              {apolloData.experience_location}
                            </div>
                          )}
                          <Badge variant="secondary" className="mt-2 text-xs">Current</Badge>
                        </div>
                      )}

                      {!isCollected && (
                        <div className="flex items-center gap-2 text-text-tertiary pt-2 border-t">
                          <Lock className="h-4 w-4" />
                          <span className="text-sm">Full work history available after collection</span>
                        </div>
                      )}

                      {isCollected && (
                        <p className="text-sm text-text-secondary text-center pt-2 border-t">
                          View complete work history on the full profile page
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Skills */}
                <AccordionItem value="skills" className="border rounded-lg bg-surface-primary">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-text-secondary" />
                      <span className="font-medium">Skills</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-4 pb-4">
                      {isCollected && enrichedData?.skills && enrichedData.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {enrichedData.skills.map((skill, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-text-tertiary">
                          <Lock className="h-4 w-4" />
                          <span className="text-sm">Skills list available after collection</span>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Education */}
                <AccordionItem value="education" className="border rounded-lg bg-surface-primary">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-text-secondary" />
                      <span className="font-medium">Education</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="px-4 pb-4">
                      {isCollected ? (
                        <p className="text-sm text-text-secondary text-center">
                          View education on the full profile page
                        </p>
                      ) : (
                        <div className="flex items-center gap-2 text-text-tertiary">
                          <Lock className="h-4 w-4" />
                          <span className="text-sm">Education history available after collection</span>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Job Selection Dialog */}
      <JobSelectionDialog
        open={showJobSelection}
        onOpenChange={setShowJobSelection}
        onJobSelected={handleJobSelected}
        onSkip={() => {
          setShowJobSelection(false)
          handleCollectProfile()
        }}
      />
    </>
  )
}
