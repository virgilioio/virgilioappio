import { useState, useEffect, useMemo, useRef } from 'react'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { 
  Sparkles, ExternalLink, AlertCircle, ChevronLeft, ChevronRight, 
  Mail, Phone, Lock, Briefcase, GraduationCap, Wrench, MapPin, 
  Building2, CheckCircle2, TrendingUp,
  Zap, Eye, Check, Star, XCircle, Info, Clock, Copy
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { useSourcingCreditWarnings } from '@/hooks/useSourcingCreditWarnings'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { JobSelectionDialog } from '@/components/sourcing/JobSelectionDialog'
import { 
  calculateFitScore, 
  type FitScore,
} from '@/lib/candidateFitScoring'
import {
  inferCareerSnapshotFromPreview,
  compareCandidateToJob,
  getRecommendation,
  generateEnrichedGioTake,
  type CareerSnapshotInference,
  type JobComparisonSummary
} from '@/features/sourcing/apollo/previewInference'
import { useCandidatePreviewStatus } from '@/hooks/useCandidatePreviewStatus'
import type { SearchCriteria } from '@/types/sourcing'
import { cn } from '@/lib/utils'
import gioFaceYellow from '@/assets/gio-face-yellow.png'

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
  projectId?: string | null
  hasPrev?: boolean
  hasNext?: boolean
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
  onCandidateCollected?: (candidateId: string) => void
  searchCriteria?: SearchCriteria
  jobTitle?: string | null
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

// Match label component
function MatchLabel({ match }: { match: 'Strong' | 'Medium' | 'Weak' | 'Unknown' }) {
  const config = {
    Strong: { color: 'text-green-600', bg: 'bg-green-100' },
    Medium: { color: 'text-amber-600', bg: 'bg-amber-100' },
    Weak: { color: 'text-red-500', bg: 'bg-red-100' },
    Unknown: { color: 'text-text-tertiary', bg: 'bg-muted' }
  }
  
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded", config[match].bg, config[match].color)}>
      {match}
    </span>
  )
}

// Search intent match bullet - shows explicit criteria matching with icons
function IntentMatchBullet({ 
  label, 
  isStrong,
  isPartial,
  isInferred
}: { 
  label: string
  isStrong?: boolean
  isPartial?: boolean
  isInferred?: boolean
}) {
  const getIcon = () => {
    if (isStrong) {
      return <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
    }
    if (isPartial || isInferred) {
      return <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
    }
    return <XCircle className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0" />
  }

  return (
    <div className="flex items-center gap-2 py-0.5">
      {getIcon()}
      <span className={cn(
        "text-sm",
        isStrong ? "text-text-primary" : "text-text-secondary"
      )}>
        {label}
        {isInferred && (
          <span className="text-xs text-text-tertiary ml-1 italic">(inferred)</span>
        )}
      </span>
    </div>
  )
}

// Typing animation component for Gio's Take
function TypewriterText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const prevTextRef = useRef<string>('')
  
  useEffect(() => {
    // Only animate if text changed significantly (new candidate)
    if (text === prevTextRef.current) {
      setDisplayedText(text)
      setIsComplete(true)
      return
    }
    
    prevTextRef.current = text
    setDisplayedText('')
    setIsComplete(false)
    
    // Fast typewriter effect - complete in ~400ms
    const totalDuration = 350
    const charsPerInterval = Math.max(1, Math.ceil(text.length / (totalDuration / 16)))
    let currentIndex = 0
    
    const interval = setInterval(() => {
      currentIndex += charsPerInterval
      if (currentIndex >= text.length) {
        setDisplayedText(text)
        setIsComplete(true)
        onComplete?.()
        clearInterval(interval)
      } else {
        setDisplayedText(text.slice(0, currentIndex))
      }
    }, 16)
    
    return () => clearInterval(interval)
  }, [text, onComplete])
  
  return (
    <span>
      {displayedText}
      {!isComplete && <span className="inline-block w-0.5 h-4 bg-primary/60 animate-pulse ml-0.5" />}
    </span>
  )
}

export function ApolloPreviewSheet({
  open,
  onOpenChange,
  apolloId,
  apolloData,
  jobId,
  projectId,
  hasPrev,
  hasNext,
  onNavigatePrev,
  onNavigateNext,
  onCandidateCollected,
  searchCriteria,
  jobTitle,
}: ApolloPreviewSheetProps) {
  const [isCollecting, setIsCollecting] = useState(false)
  const [collectedCandidateId, setCollectedCandidateId] = useState<string | null>(null)
  const [collectedJobId, setCollectedJobId] = useState<string | null>(null)
  const [showJobSelection, setShowJobSelection] = useState(false)
  const [enrichedData, setEnrichedData] = useState<EnrichedCandidateData | null>(null)
  const [phoneCheckStatus, setPhoneCheckStatus] = useState<'idle' | 'checking' | 'done'>('idle')
  const { isCollectDisabled } = useSourcingCreditWarnings()
  const { shortlistCandidate, markNotAFit, isUpdating, currentApolloId } = useCandidatePreviewStatus()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Reset state when apolloId changes
  useEffect(() => {
    setEnrichedData(null)
    setCollectedCandidateId(null)
    setCollectedJobId(null)
    setPhoneCheckStatus('idle')
  }, [apolloId])

  // Poll for phone number after collection if has_phone was indicated but not received
  useEffect(() => {
    if (!enrichedData?.candidate_id || enrichedData?.phone || !apolloData?.has_phone) {
      return
    }

    setPhoneCheckStatus('checking')
    let attempts = 0
    const maxAttempts = 4
    const intervals = [2000, 3000, 5000, 8000]

    const pollForPhone = async () => {
      if (attempts >= maxAttempts) {
        setPhoneCheckStatus('done')
        return
      }

      const delay = intervals[attempts] || 5000
      attempts++

      await new Promise(resolve => setTimeout(resolve, delay))

      try {
        const { data: candidateData } = await supabase
          .from('candidates')
          .select('phone')
          .eq('id', enrichedData.candidate_id)
          .single()

        if (candidateData?.phone) {
          setEnrichedData(prev => prev ? { ...prev, phone: candidateData.phone } : prev)
          setPhoneCheckStatus('done')
          return
        }

        pollForPhone()
      } catch {
        setPhoneCheckStatus('done')
      }
    }

    pollForPhone()
  }, [enrichedData?.candidate_id, enrichedData?.phone, apolloData?.has_phone])

  // Calculate fit score
  const fitScore: FitScore = useMemo(() => {
    if (!apolloData) {
      return { overall: 50, roleAlignment: 'medium', skillsMatch: 'medium', locationMatch: 'medium', confidence: 0, dataRichness: 0 }
    }
    return calculateFitScore(apolloData, searchCriteria)
  }, [apolloData, searchCriteria])

  // Calculate career snapshot inference
  const careerSnapshot: CareerSnapshotInference = useMemo(() => {
    return inferCareerSnapshotFromPreview({
      candidateTitle: apolloData?.current_role,
      companyName: apolloData?.current_company,
      headline: apolloData?.headline,
      apolloIndustry: apolloData?.industry || apolloData?.company_industry
    })
  }, [apolloData])

  // Calculate job comparison
  const jobComparison: JobComparisonSummary = useMemo(() => {
    return compareCandidateToJob({
      jobTitle: jobTitle || searchCriteria?.title_keywords?.[0],
      jobSeniority: searchCriteria?.seniorities?.[0],
      jobLocation: searchCriteria?.locations?.[0],
      jobIndustry: careerSnapshot.industryLabel !== 'Unknown' ? careerSnapshot.industryLabel : undefined,
      candidate: careerSnapshot,
      candidateTitle: apolloData?.current_role,
      candidateLocation: apolloData?.location
    })
  }, [apolloData, searchCriteria, careerSnapshot, jobTitle])

  // Generate candidate-specific Gio's Take
  const gioTakeText = useMemo(() => {
    return generateEnrichedGioTake(
      careerSnapshot, 
      jobComparison, 
      fitScore.overall, 
      fitScore.confidence,
      {
        candidateName: apolloData?.candidate_name,
        currentRole: apolloData?.current_role,
        currentCompany: apolloData?.current_company,
        location: apolloData?.location,
        headline: apolloData?.headline
      },
      {
        titleKeywords: searchCriteria?.title_keywords,
        locations: searchCriteria?.locations,
        seniorities: searchCriteria?.seniorities,
        skills: searchCriteria?.skills
      }
    )
  }, [careerSnapshot, jobComparison, fitScore.overall, fitScore.confidence, apolloData, searchCriteria])

  const recommendation = useMemo(() => {
    return getRecommendation(fitScore.overall, fitScore.confidence)
  }, [fitScore.overall, fitScore.confidence])

  // Generate intent match bullets
  const intentBullets = useMemo(() => {
    const bullets: { label: string; isStrong?: boolean; isPartial?: boolean; isInferred?: boolean }[] = []
    
    // Title/Role match
    if (apolloData?.current_role && searchCriteria?.title_keywords?.length) {
      const targetTitle = searchCriteria.title_keywords[0]
      if (jobComparison.titleMatchLabel === 'Strong') {
        bullets.push({ label: `${careerSnapshot.functionLabel} leadership role`, isStrong: true })
      } else if (jobComparison.titleMatchLabel === 'Medium') {
        bullets.push({ label: `${careerSnapshot.functionLabel} background`, isPartial: true, isInferred: true })
      } else if (apolloData.current_role) {
        bullets.push({ label: `Currently: ${apolloData.current_role}`, isPartial: true })
      }
    } else if (apolloData?.current_role) {
      bullets.push({ label: `${careerSnapshot.functionLabel} function`, isPartial: true, isInferred: true })
    }
    
    // Seniority match
    if (careerSnapshot.seniority !== 'Unknown') {
      const isStrongSeniority = jobComparison.seniorityMatchLabel === 'Strong'
      const isMediumSeniority = jobComparison.seniorityMatchLabel === 'Medium'
      bullets.push({ 
        label: `${careerSnapshot.seniority} seniority`, 
        isStrong: isStrongSeniority,
        isPartial: isMediumSeniority,
        isInferred: !searchCriteria?.seniorities?.length
      })
    }
    
    // Location match
    if (apolloData?.location) {
      if (jobComparison.locationMatchLabel === 'Strong') {
        bullets.push({ label: `Based in ${apolloData.location}`, isStrong: true })
      } else if (jobComparison.locationMatchLabel === 'Medium') {
        bullets.push({ label: `Location: ${apolloData.location}`, isPartial: true })
      } else if (searchCriteria?.locations?.length) {
        bullets.push({ label: `Location mismatch`, isPartial: false })
      }
    } else if (searchCriteria?.locations?.length) {
      bullets.push({ label: `Location not confirmed`, isInferred: true })
    }
    
    // Industry/Domain match
    if (careerSnapshot.industryLabel !== 'Unknown') {
      const isStrongIndustry = jobComparison.industryMatchLabel === 'Strong'
      bullets.push({ 
        label: `${careerSnapshot.industryLabel} background`, 
        isStrong: isStrongIndustry,
        isPartial: !isStrongIndustry,
        isInferred: true
      })
    }
    
    return bullets.slice(0, 5)
  }, [apolloData, searchCriteria, careerSnapshot, jobComparison])

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
        queryClient.invalidateQueries({ queryKey: ['saved-candidates'] })

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

  const handleJobSelected = (jId: string, jobName: string, stageId?: string, stageName?: string) => {
    setShowJobSelection(false)
    handleCollectProfile(jId, jobName, stageId, stageName)
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

  const handleShortlist = () => {
    if (apolloId && projectId) {
      shortlistCandidate(apolloId, projectId)
    }
  }

  const handleNotAFit = () => {
    if (apolloId && projectId) {
      markNotAFit(apolloId, projectId)
    }
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

  const recommendationBadgeColors: Record<string, string> = {
    worth_unlocking: 'bg-green-100 text-green-700 border-green-200',
    borderline: 'bg-amber-100 text-amber-700 border-amber-200',
    probably_skip: 'bg-red-100 text-red-600 border-red-200',
    low_data: 'bg-slate-100 text-slate-600 border-slate-200'
  }

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
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* WHY THIS IS WORTH A LOOK - Primary Section with Lilac Purple */}
              {!isCollected && (
                <Card className="border-virgilio-purple/25 bg-accent shadow-sm">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0">
                        <img src={gioFaceYellow} alt="Gio" className="h-full w-full object-cover" />
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-virgilio-purple">Why this is worth a look</span>
                          <Sparkles className="h-3.5 w-3.5 text-virgilio-purple/70" />
                        </div>
                        <p className="text-sm text-text-primary leading-relaxed">
                          <TypewriterText text={gioTakeText} key={apolloId} />
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* MATCHES YOUR SEARCH - Intent Mirroring Section */}
              {!isCollected && intentBullets.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-text-secondary flex items-center gap-2">
                      Matches your search
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      {intentBullets.map((bullet, idx) => (
                        <IntentMatchBullet 
                          key={idx}
                          label={bullet.label}
                          isStrong={bullet.isStrong}
                          isPartial={bullet.isPartial}
                          isInferred={bullet.isInferred}
                        />
                      ))}
                    </div>
                    
                    {/* De-emphasized Confidence Signal */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                      <span className="text-xs text-text-tertiary">Signal strength</span>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs",
                          fitScore.overall >= 65 ? "text-green-600" : 
                          fitScore.overall >= 45 ? "text-amber-600" : "text-text-tertiary"
                        )}>
                          {fitScore.overall}/100
                        </span>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", recommendationBadgeColors[recommendation.type])}
                        >
                          {recommendation.label}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* UNLOCK CTA - Reframed as Confirmation */}
              {!isCollected && (
                <Card className="border-primary/30 bg-surface-primary">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-text-secondary">
                          This profile already matches your search. Unlocking confirms contact info and full work history.
                        </p>
                      </div>
                      
                      {/* What unlock reveals */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        <span className="flex items-center gap-1.5 text-text-secondary">
                          <Mail className={cn("h-3 w-3", hasEmailAvailable ? "text-green-500" : "text-text-tertiary")} />
                          {hasEmailAvailable ? "Verified email" : "Email"}
                        </span>
                        <span className="flex items-center gap-1.5 text-text-secondary">
                          <Phone className={cn("h-3 w-3", hasPhoneAvailable ? "text-green-500" : "text-text-tertiary")} />
                          {hasPhoneAvailable ? "Phone number" : "Phone"}
                        </span>
                        <span className="flex items-center gap-1.5 text-text-secondary">
                          <Briefcase className="h-3 w-3 text-text-tertiary" />
                          Full work history
                        </span>
                        <span className="flex items-center gap-1.5 text-text-secondary">
                          <Wrench className="h-3 w-3 text-text-tertiary" />
                          Skills + education
                        </span>
                      </div>

                      <Button
                        onClick={() => {
                          if (!jobId) {
                            setShowJobSelection(true)
                          } else {
                            handleCollectProfile()
                          }
                        }}
                        disabled={isCollecting || isCollectDisabled}
                        className="w-full"
                        size="default"
                      >
                        {isCollecting ? (
                          <>
                            <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                            Unlocking...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Unlock with 1 credit
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Candidate Snapshot */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {isCollected ? 'Profile Details' : 'Candidate Snapshot'}
                    </CardTitle>
                    {!isCollected && (
                      <Badge variant="outline" className="text-xs text-text-tertiary border-dashed">
                        <Info className="h-3 w-3 mr-1" />
                        Inferred
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Basic Info Grid */}
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
                  </div>

                  {/* Headline */}
                  {apolloData?.headline && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-text-secondary italic">
                        "{apolloData.headline}"
                      </p>
                    </div>
                  )}

                  {/* Inferred Insights Section (only in preview) */}
                  {!isCollected && (
                    <div className="pt-4 border-t">
                      <p className="text-xs font-medium text-text-tertiary mb-3">Inferred Insights</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs text-text-tertiary">Seniority</span>
                          <div className="mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {careerSnapshot.seniority}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-text-tertiary">Likely Experience</span>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3 text-text-tertiary" />
                            <span className="text-sm text-text-primary">{careerSnapshot.yearsRangeLabel}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-text-tertiary">Function</span>
                          <p className="text-sm text-text-primary mt-1">{careerSnapshot.functionLabel}</p>
                        </div>
                        {careerSnapshot.companyStageLabel !== 'Unknown' && (
                          <div>
                            <span className="text-xs text-text-tertiary">Company Stage</span>
                            <p className="text-sm text-text-primary mt-1">{careerSnapshot.companyStageLabel}</p>
                          </div>
                        )}
                      </div>

                      {careerSnapshot.idealRoleExamples.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-dashed">
                          <span className="text-xs text-text-tertiary">Ideal for roles like</span>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {careerSnapshot.idealRoleExamples.map((role, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {careerSnapshot.caveats.length > 0 && (
                        <p className="text-xs text-text-tertiary mt-3 italic">
                          {careerSnapshot.caveats[0]}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Compared to Job Card */}
              {!isCollected && (jobTitle || searchCriteria?.title_keywords?.[0]) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      Compared to "{jobTitle || searchCriteria?.title_keywords?.[0]}"
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-secondary">Title</span>
                        <MatchLabel match={jobComparison.titleMatchLabel} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-secondary">Location</span>
                        <MatchLabel match={jobComparison.locationMatchLabel} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-secondary">Industry</span>
                        <MatchLabel match={jobComparison.industryMatchLabel} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-secondary">Seniority</span>
                        <MatchLabel match={jobComparison.seniorityMatchLabel} />
                      </div>
                    </div>

                    {jobComparison.notes.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <ul className="space-y-1">
                          {jobComparison.notes.slice(0, 3).map((note, idx) => (
                            <li key={idx} className="text-xs text-text-tertiary flex items-start gap-2">
                              <span>•</span>
                              {note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Non-credit actions: Shortlist & Not a Fit */}
              {!isCollected && projectId && (
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleShortlist}
                    disabled={isUpdating && currentApolloId === apolloId}
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Shortlist
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-text-tertiary hover:text-red-600 hover:border-red-200"
                    onClick={handleNotAFit}
                    disabled={isUpdating && currentApolloId === apolloId}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Not a fit
                  </Button>
                </div>
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
                          if (collectedJobId && enrichedData?.candidate_id) {
                            navigate(`/jobs/${collectedJobId}?candidate=${enrichedData.candidate_id}`)
                          } else if (enrichedData?.candidate_id) {
                            navigate(`/candidates/${enrichedData.candidate_id}`)
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
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Mail className="h-4 w-4 text-text-secondary flex-shrink-0" />
                                <a href={`mailto:${enrichedData.email}`} className="text-sm text-blue-600 hover:underline truncate">
                                  {enrichedData.email}
                                </a>
                                <Badge variant="secondary" className="text-xs flex-shrink-0">
                                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                                  Verified
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 flex-shrink-0"
                                onClick={() => {
                                  navigator.clipboard.writeText(enrichedData.email!);
                                  toast({ title: 'Copied', description: 'Email copied to clipboard' });
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-text-secondary" />
                            {enrichedData?.phone ? (
                              <a href={`tel:${enrichedData.phone}`} className="text-sm text-blue-600 hover:underline">
                                {enrichedData.phone}
                              </a>
                            ) : phoneCheckStatus === 'checking' ? (
                              <span className="text-sm text-amber-600 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse" />
                                Checking for phone...
                              </span>
                            ) : apolloData?.has_phone ? (
                              <span className="text-sm text-text-tertiary">Phone pending - try refreshing</span>
                            ) : (
                              <span className="text-sm text-text-tertiary">Phone not available</span>
                            )}
                          </div>
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
                          View education details on the full profile page
                        </p>
                      ) : (
                        <div className="flex items-center gap-2 text-text-tertiary">
                          <Lock className="h-4 w-4" />
                          <span className="text-sm">Education details available after collection</span>
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
          handleCollectProfile() // Collect without job - adds to universal candidate list
        }}
        initialJobId={jobId}
      />
    </>
  )
}
