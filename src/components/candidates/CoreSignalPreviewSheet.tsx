import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { Sparkles, ExternalLink, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { useCoresignalCreditWarnings } from '@/hooks/useCoresignalCreditWarnings'
import AddToJobPipelineDialog from './AddToJobPipelineDialog'

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
  }
  jobId?: string | null
  hasPrev?: boolean
  hasNext?: boolean
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
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
}: CoreSignalPreviewSheetProps) {
  const [isCollecting, setIsCollecting] = useState(false)
  const [collectedCandidateId, setCollectedCandidateId] = useState<string | null>(null)
  const { isCollectDisabled } = useCoresignalCreditWarnings()

  const handleCollectProfile = async () => {
    if (!coresignalId) return

    setIsCollecting(true)
    try {
      const { data, error } = await supabase.functions.invoke('collect-coresignal-profile', {
        body: {
          coresignal_id: parseInt(coresignalId),
          job_id: jobId,
        }
      })

      if (error) throw error

      if (data?.candidate_id) {
        setCollectedCandidateId(data.candidate_id)
        toast({
          title: 'Profile Collected',
          description: 'Full profile has been collected successfully. Reloading...',
        })
        // Close and let parent refresh
        setTimeout(() => {
          window.location.reload()
        }, 1000)
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
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Preview Data Card */}
              <Card className="bg-surface-primary border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Available Information
                    <Badge variant="secondary" className="text-xs">Preview</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {coresignalData?.current_role && (
                    <div>
                      <div className="text-sm text-text-secondary mb-1">Current Role</div>
                      <div className="text-base font-medium">{coresignalData.current_role}</div>
                    </div>
                  )}

                  {coresignalData?.current_company && (
                    <div>
                      <div className="text-sm text-text-secondary mb-1">Current Company</div>
                      <div className="text-base font-medium">{coresignalData.current_company}</div>
                    </div>
                  )}

                  {coresignalData?.location && (
                    <div>
                      <div className="text-sm text-text-secondary mb-1">Location</div>
                      <div className="text-base">{coresignalData.location}</div>
                    </div>
                  )}

                  {coresignalData?.headline && (
                    <div>
                      <div className="text-sm text-text-secondary mb-1">Headline</div>
                      <div className="text-base">{coresignalData.headline}</div>
                    </div>
                  )}

                  {coresignalData?.coresignal_score !== undefined && (
                    <div>
                      <div className="text-sm text-text-secondary mb-1">Match Score</div>
                      <Badge variant="outline">{coresignalData.coresignal_score.toFixed(2)}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Card */}
              <Card className="bg-surface-primary border-border">
                <CardHeader>
                  <CardTitle>Next Steps</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={handleCollectProfile}
                    disabled={isCollecting || isCollectDisabled}
                    className="w-full"
                    size="lg"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isCollecting ? 'Collecting...' : isCollectDisabled ? 'Credit Limit Reached' : 'Collect Full Profile (1 credit)'}
                  </Button>

                  {jobId && collectedCandidateId && (
                    <AddToJobPipelineDialog candidateId={collectedCandidateId} />
                  )}

                  {coresignalData?.linkedin_url && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(coresignalData.linkedin_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View LinkedIn Profile
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Information Notice */}
              <Card className="bg-warning/10 border-warning">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <div className="font-medium text-warning">Limited Preview Data</div>
                      <div className="text-sm text-text-secondary">
                        This is a preview from CoreSignal's search results. To view the full profile including 
                        work experience, education, skills, and contact information, you need to collect the 
                        full profile (costs 1 CoreSignal credit).
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
