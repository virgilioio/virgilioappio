import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { useAnalyticsMetrics, DateRange } from '@/hooks/useAnalyticsMetrics'
import { useStagePerformanceMetrics } from '@/hooks/analytics/useStagePerformanceMetrics'
import { useJobHealthMetrics } from '@/hooks/analytics/useJobHealthMetrics'
import { useRecruiterPerformanceMetrics } from '@/hooks/analytics/useRecruiterPerformanceMetrics'
import { useSourcePerformanceMetrics } from '@/hooks/analytics/useSourcePerformanceMetrics'
import { useInterviewHealthMetrics } from '@/hooks/analytics/useInterviewHealthMetrics'
import { useOfferAnalyticsMetrics } from '@/hooks/analytics/useOfferAnalyticsMetrics'
import { useTalentInsightsMetrics } from '@/hooks/analytics/useTalentInsightsMetrics'
import { AnalyticsTimeFilter } from '@/components/analytics/AnalyticsTimeFilter'
import { AnalyticsFiltersBar, AnalyticsFilters } from '@/components/analytics/AnalyticsFiltersBar'
import { OverviewSection } from '@/components/analytics/sections/OverviewSection'
import { PipelineHealthSection } from '@/components/analytics/sections/PipelineHealthSection'
import { StagePerformanceSection } from '@/components/analytics/sections/StagePerformanceSection'
import { JobHealthSection } from '@/components/analytics/sections/JobHealthSection'
import { RecruiterPerformanceSection } from '@/components/analytics/sections/RecruiterPerformanceSection'
import { SourcePerformanceSection } from '@/components/analytics/sections/SourcePerformanceSection'
import { InterviewHealthSection } from '@/components/analytics/sections/InterviewHealthSection'
import { OfferAnalyticsSection } from '@/components/analytics/sections/OfferAnalyticsSection'
import { TalentInsightsSection } from '@/components/analytics/sections/TalentInsightsSection'
import { Button } from '@/components/ui/button'
import { BarChart3, Download, Loader2 } from 'lucide-react'
import { subDays } from 'date-fns'
import { generateAnalyticsReport } from '@/utils/analyticsReportGenerator'

export default function Analytics() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isPlatformAdmin, isWorkspaceOwner, isAdmin } = usePermissions()
  const canAccessAnalytics = isPlatformAdmin || isWorkspaceOwner || isAdmin

  useEffect(() => {
    if (canAccessAnalytics === false) {
      toast({
        title: 'Access Denied',
        description: 'Analytics is only available to administrators.',
        variant: 'destructive',
      })
      navigate('/dashboard')
    }
  }, [canAccessAnalytics, navigate, toast])

  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: subDays(new Date(), 7),
    endDate: new Date(),
  })

  const [advancedFilters, setAdvancedFilters] = useState<AnalyticsFilters>({
    recruiterIds: [],
    jobIds: [],
    organizationIds: [],
    jobStatus: 'open',
  })

  // Core metrics (existing)
  const metrics = useAnalyticsMetrics({ dateRange, ...advancedFilters })
  const hasJobIds = metrics.finalJobIds.length > 0 && !metrics.isLoading

  // New section hooks — only fire when we have job IDs
  const stageData = useStagePerformanceMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const jobHealth = useJobHealthMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const recruiterData = useRecruiterPerformanceMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const sourceData = useSourcePerformanceMetrics(metrics.finalJobIds, hasJobIds)
  const interviewData = useInterviewHealthMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const offerData = useOfferAnalyticsMetrics(metrics.finalJobIds, dateRange, hasJobIds)
  const talentData = useTalentInsightsMetrics(metrics.finalJobIds, hasJobIds)

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setDateRange({ startDate, endDate })
  }

  const handleFiltersChange = useCallback((filters: AnalyticsFilters) => {
    setAdvancedFilters(filters)
  }, [])

  const [isExporting, setIsExporting] = useState(false)

  const handleExportReport = async () => {
    setIsExporting(true)
    try {
      await generateAnalyticsReport({
        data: {
          applications: metrics.applications,
          activeCandidates: metrics.activeCandidates,
          totalOffers: metrics.totalOffers,
          totalHires: metrics.totalHires,
          interviewsScheduled: metrics.interviewsScheduled,
          interviewsCompleted: metrics.interviewsCompleted,
          rejectedCandidates: metrics.rejectedCandidates,
          statusDistribution: metrics.statusDistribution,
          stageDistribution: metrics.stageDistribution,
          trendData: metrics.trendData,
          interviewsByStage: [],
          stageConversions: [],
          avgTimePerStage: [],
        },
        dateRange,
      })
      toast({ title: 'Report exported', description: 'Your analytics report has been downloaded.' })
    } catch (error) {
      console.error('[Analytics] Export failed:', error)
      toast({ title: 'Export failed', description: 'Failed to generate the report. Please try again.', variant: 'destructive' })
    } finally {
      setIsExporting(false)
    }
  }

  if (canAccessAnalytics === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-virgilio-purple border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!canAccessAnalytics) return null

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-virgilio-purple/10">
            <BarChart3 className="h-6 w-6 text-virgilio-purple" />
          </div>
          <div>
            <h1 className="text-2xl font-poppins font-semibold text-virgilio-text">
              Analytics<span className="text-[hsl(var(--purple-period))]">.</span>
            </h1>
            <p className="text-sm text-virgilio-muted font-poppins">
              Recruiting operations dashboard
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleExportReport}
            disabled={isExporting || metrics.isLoading}
            className="gap-2"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export Report
          </Button>
          <AnalyticsTimeFilter onDateRangeChange={handleDateRangeChange} />
        </div>
      </div>

      {/* Filter Chips */}
      <AnalyticsFiltersBar onFiltersChange={handleFiltersChange} />

      {/* ─── Sections ─── */}
      <OverviewSection metrics={metrics} />
      <PipelineHealthSection metrics={metrics} />
      <StagePerformanceSection metrics={metrics} stageData={stageData} />
      <JobHealthSection data={jobHealth} />
      <RecruiterPerformanceSection data={recruiterData} />
      <SourcePerformanceSection data={sourceData} />
      <InterviewHealthSection data={interviewData} />
      <OfferAnalyticsSection data={offerData} />
      <TalentInsightsSection data={talentData} />
    </div>
  )
}
