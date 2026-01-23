import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { useAnalyticsMetrics, DateRange } from '@/hooks/useAnalyticsMetrics'
import { AnalyticsTimeFilter } from '@/components/analytics/AnalyticsTimeFilter'
import { AnalyticsFiltersBar, AnalyticsFilters } from '@/components/analytics/AnalyticsFiltersBar'
import { ApplicationsTrendChart } from '@/components/analytics/ApplicationsTrendChart'
import { CandidateStatusPieChart } from '@/components/analytics/CandidateStatusPieChart'
import { StageDistributionChart } from '@/components/analytics/StageDistributionChart'
import { RecruitmentFunnelChart } from '@/components/analytics/RecruitmentFunnelChart'
import { PipelineOverviewTable } from '@/components/analytics/PipelineOverviewTable'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Users, UserCheck, CalendarPlus, CalendarCheck, UserX, BarChart3, Download, Loader2 } from 'lucide-react'
import { subDays } from 'date-fns'
import { generateAnalyticsReport } from '@/utils/analyticsReportGenerator'

export default function Analytics() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isPlatformAdmin, isWorkspaceOwner, isAdmin } = usePermissions()
  
  const canAccessAnalytics = isPlatformAdmin || isWorkspaceOwner || isAdmin

  // Redirect users without analytics access
  useEffect(() => {
    if (canAccessAnalytics === false) {
      toast({
        title: 'Access Denied',
        description: 'Analytics is only available to administrators.',
        variant: 'destructive'
      })
      navigate('/dashboard')
    }
  }, [canAccessAnalytics, navigate, toast])

  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: subDays(new Date(), 7),
    endDate: new Date()
  })

  const [advancedFilters, setAdvancedFilters] = useState<AnalyticsFilters>({
    recruiterIds: [],
    jobIds: [],
    organizationIds: []
  })

  const metrics = useAnalyticsMetrics({
    dateRange,
    ...advancedFilters
  })

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
          // Global analytics doesn't have per-stage breakdowns yet
          interviewsByStage: [],
          stageConversions: [],
          avgTimePerStage: []
        },
        dateRange
      })
      toast({
        title: 'Report exported',
        description: 'Your analytics report has been downloaded.',
      })
    } catch (error) {
      console.error('[Analytics] Export failed:', error)
      toast({
        title: 'Export failed',
        description: 'Failed to generate the report. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsExporting(false)
    }
  }

  // Don't render until we verify access status
  if (canAccessAnalytics === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-virgilio-purple border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!canAccessAnalytics) {
    return null
  }

  const metricCards = [
    {
      title: 'Applications',
      value: metrics.applications,
      icon: FileText,
      bgColor: 'hsl(267 84% 87%)',
      iconColor: 'hsl(267 89% 60%)',
      tooltip: 'New applications in selected period'
    },
    {
      title: 'Active',
      value: metrics.activeCandidates,
      icon: Users,
      bgColor: 'hsl(180 100% 88%)',
      iconColor: 'hsl(180 100% 35%)',
      tooltip: 'Currently active candidates (all time)'
    },
    {
      title: 'Hires',
      value: metrics.totalHires,
      icon: UserCheck,
      bgColor: 'hsl(120 100% 88%)',
      iconColor: 'hsl(120 100% 30%)',
      tooltip: 'Candidates hired in selected period'
    },
    {
      title: 'Scheduled',
      value: metrics.interviewsScheduled,
      icon: CalendarPlus,
      bgColor: 'hsl(48 100% 90%)',
      iconColor: 'hsl(48 100% 35%)',
      tooltip: 'Interviews scheduled in selected period'
    },
    {
      title: 'Completed',
      value: metrics.interviewsCompleted,
      icon: CalendarCheck,
      bgColor: 'hsl(200 100% 88%)',
      iconColor: 'hsl(200 100% 35%)',
      tooltip: 'Interviews completed in selected period'
    },
    {
      title: 'Rejected',
      value: metrics.rejectedCandidates,
      icon: UserX,
      bgColor: 'hsl(0 70% 92%)',
      iconColor: 'hsl(0 70% 50%)',
      tooltip: 'Total rejected candidates (all time)'
    }
  ]

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
              Platform-wide metrics and insights
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
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export Report
          </Button>
          <AnalyticsTimeFilter onDateRangeChange={handleDateRangeChange} />
        </div>
      </div>

      {/* Advanced Filters */}
      <AnalyticsFiltersBar onFiltersChange={handleFiltersChange} />

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {metricCards.map((card) => (
          <Card key={card.title} className="border-virgilio-border hover:shadow-lg transition-shadow" title={card.tooltip}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-poppins font-medium text-virgilio-muted">
                    {card.title}
                  </p>
                  <p className="text-2xl lg:text-3xl font-poppins font-bold text-virgilio-text mt-1">
                    {metrics.isLoading ? (
                      <span className="inline-block w-12 h-8 bg-virgilio-border/50 rounded animate-pulse" />
                    ) : (
                      card.value.toLocaleString()
                    )}
                  </p>
                </div>
                <div
                  className="p-2 lg:p-3 rounded-xl"
                  style={{ backgroundColor: card.bgColor }}
                >
                  <card.icon
                    className="h-4 w-4 lg:h-5 lg:w-5"
                    style={{ color: card.iconColor }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Overview Table */}
      <PipelineOverviewTable 
        jobIds={metrics.finalJobIds} 
        isLoading={metrics.isLoading} 
      />

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ApplicationsTrendChart data={metrics.trendData} isLoading={metrics.isLoading} />
        <CandidateStatusPieChart data={metrics.statusDistribution} isLoading={metrics.isLoading} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecruitmentFunnelChart 
          data={{
            applications: metrics.applications,
            activeCandidates: metrics.activeCandidates,
            offers: metrics.totalOffers,
            totalHires: metrics.totalHires
          }} 
          isLoading={metrics.isLoading} 
        />
        <StageDistributionChart data={metrics.stageDistribution} isLoading={metrics.isLoading} />
      </div>
    </div>
  )
}
