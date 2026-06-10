import { useCandidateFitInsights } from '@/hooks/useCandidateFitInsights'
import { NoJobDescriptionCard } from './NoJobDescriptionCard'
import { FitScoreRadial } from './FitScoreRadial'
import { FitDimensionCard } from './FitDimensionCard'
import { ValidationChecklist } from './ValidationChecklist'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Sparkles, Loader2, CheckCircle2, AlertCircle, Database } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EmptyState, EmptyAction } from '@/components/ui/empty-state'
import { SoftRosette } from '@/components/ui/EmptyIllustrations'
import { useEffect, useRef } from 'react'

const cardClass = 'border-virgilio-border rounded-2xl shadow-md hover:shadow-xl transition-all duration-200'

interface CandidateInsightsTabProps {
  candidateId: string
  jobId: string
  jobDescription?: string | null
}

export function CandidateInsightsTab({ candidateId, jobId, jobDescription }: CandidateInsightsTabProps) {
  const { insights, isLoading, isRefreshing, refreshInsights } = useCandidateFitInsights(candidateId, jobId)
  const hasTriggered = useRef(false)

  // Auto-trigger analysis if none exists yet
  useEffect(() => {
    if (!isLoading && !insights?.analysis && !hasTriggered.current && jobDescription && jobDescription.replace(/<[^>]*>/g, '').trim().length >= 30) {
      hasTriggered.current = true
      refreshInsights()
    }
  }, [isLoading, insights?.analysis, jobDescription])

  // Check for missing JD
  const jdText = (jobDescription || '').replace(/<[^>]*>/g, '').trim()
  if (jdText.length < 30) {
    return <NoJobDescriptionCard jobId={jobId} />
  }

  if (isLoading) {
    return (
      <Card className={cardClass}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-virgilio-purple" />
        </CardContent>
      </Card>
    )
  }

  // Show generating state
  if (isRefreshing && !insights?.analysis) {
    return (
      <Card className={cardClass}>
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-virgilio-purple" />
          <p className="text-sm text-virgilio-muted font-poppins">Analyzing candidate fit...</p>
          <p className="text-xs text-virgilio-muted/70 font-poppins">This may take a few seconds</p>
        </CardContent>
      </Card>
    )
  }

  if (!insights?.analysis) {
    return (
      <Card className={cardClass}>
        <CardContent className="p-0">
          <EmptyState
            size="card"
            illustration={<SoftRosette />}
            title="No analysis yet"
            body="Generate AI insights to evaluate fit for this role."
            primary={
              <EmptyAction
                variant="primary"
                icon={isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                onClick={refreshInsights}
              >
                {isRefreshing ? 'Generating…' : 'Generate insights'}
              </EmptyAction>
            }
          />
        </CardContent>
      </Card>
    )
  }

  const { analysis } = insights

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-4 pr-3">
        {/* Score Header */}
        <Card className={cardClass}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <FitScoreRadial
                score={analysis.overall_score}
                confidence={analysis.confidence}
                confidenceReason={analysis.confidence_reason}
                generatedAt={insights.generatedAt}
              />
              <Button variant="ghost" size="sm" onClick={refreshInsights} disabled={isRefreshing} className="gap-1.5 font-poppins">
                {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Executive Summary */}
        <Card className={cardClass}>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-virgilio-text font-poppins leading-relaxed">{analysis.executive_summary}</p>
          </CardContent>
        </Card>

        {/* Dimensions */}
        <Card className={cardClass}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-virgilio-purple/10">
                <Sparkles className="h-4 w-4 text-virgilio-purple" />
              </div>
              <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
                Fit Dimensions
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {analysis.dimensions.map((dim) => (
              <FitDimensionCard key={dim.name} dimension={dim} />
            ))}
          </CardContent>
        </Card>

        {/* Validation Checklist */}
        {analysis.validation_points.length > 0 && (
          <Card className={cardClass}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-virgilio-purple/10">
                  <CheckCircle2 className="h-4 w-4 text-virgilio-purple" />
                </div>
                <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
                  Points to Validate
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ValidationChecklist points={analysis.validation_points} />
            </CardContent>
          </Card>
        )}

        {/* Data Completeness */}
        <Card className={cardClass}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-virgilio-purple/10">
                <Database className="h-4 w-4 text-virgilio-purple" />
              </div>
              <CardTitle className="text-sm font-poppins font-semibold text-virgilio-text" withPeriod={false}>
                Data Completeness
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {analysis.data_sources_used.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {analysis.data_sources_used.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs font-poppins gap-1 bg-virgilio-purple/10 text-virgilio-purple">
                      <CheckCircle2 className="h-3 w-3" />
                      {s.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}
              {analysis.data_sources_missing.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {analysis.data_sources_missing.map((s) => (
                    <Badge key={s} variant="outline" className="text-xs font-poppins gap-1 text-virgilio-muted">
                      <AlertCircle className="h-3 w-3" />
                      {s.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  )
}
